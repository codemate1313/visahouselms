import { type FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { lockBodyScroll } from "@/utils/scrollLock";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmDelete } from "@/components/confirmDialog";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { isEqual } from "@/utils/isEqual";
import type {
  ExamModule,
  ExamModuleAsset,
  ExamModulePart,
  ExamModuleQuestion,
  ExamModuleType,
  ExamSection,
  QuestionDraft,
  QuestionImportPreview,
} from "@/api/types";
import { moduleEditorStrings as strings } from "./ModuleEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES, COMPOSED_TASK_LAYOUTS, COMPOSITE_TYPES, DERIVED_DURATION_MODULE_TYPES, MODULE_TYPES, SOURCE_SECTIONS, defaultSpeakingTurn, detectConversationSpeakers, emptyQuestion, notepadPromptForBlank, questionPayload } from "./helpers";
import { NewModuleForm } from "./components/NewModuleForm";
import { ModulePartNav } from "./components/ModulePartNav";
import { ModuleReadinessPanel } from "./components/ModuleReadinessPanel";
import { ModuleDetailsForm, type ModuleDetailsState } from "./components/ModuleDetailsForm";
import { PartSpecPanel } from "./components/PartSpecPanel";
import { ListeningAudioPanel } from "./components/ListeningAudioPanel";
import { SONIA_EXAMINER } from "./speakingExaminer";
import { SharedPassagePanel } from "./components/SharedPassagePanel";
import { GapTaskComposer, type GapTaskDraft } from "./components/GapTaskComposer";
import { NotepadGapsComposer, type NotepadTaskDraft } from "./components/NotepadGapsComposer";
import { SourceTextComposer, type SourceTextDraft } from "./components/SourceTextComposer";
import { ManualQuestionForm } from "./components/ManualQuestionForm";
import { BulkImportForm } from "./components/BulkImportForm";
import { ImportReviewPanel } from "./components/ImportReviewPanel";
import { SavedQuestionsList } from "./components/SavedQuestionsList";
import { Badge } from "@/components/ui";

export function ModuleEditor() {
  const { id, type: rawType } = useParams();
  const isNew = !id;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = rawType && MODULE_TYPES.has(rawType as ExamModuleType) ? rawType as ExamModuleType : null;
  const [module, setModule] = useState<ExamModule | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [details, setDetails] = useState<ModuleDetailsState>({ title: "", description: "", instructions: "", duration_minutes: 1, show_onboarding_instructions: true, onboarding_instructions: [] });
  const [sourceModules, setSourceModules] = useState<ExamModule[]>([]);
  const [selectedSources, setSelectedSources] = useState<Record<ExamSection, string>>({ listening: "", reading: "", writing: "", speaking: "" });
  const [loadingSources, setLoadingSources] = useState(false);
  const [manual, setManual] = useState<QuestionDraft | null>(null);
  // Which part the current draft belongs to, so a reload can tell "same part,
  // keep what is typed" from "different part, start fresh".
  const manualPartIdRef = useRef<number | null>(null);
  // Last details payload received from the server, used to tell an untouched
  // form (safe to refresh) from one with unsaved edits (must be preserved).
  const serverDetailsRef = useRef<ModuleDetailsState | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<QuestionImportPreview | null>(null);
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTitle, setAudioTitle] = useState("Listening audio");
  const [tts, setTts] = useState({ title: "Generated conversation", conversation: "", rate: "+0%" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingSpeakingPdf, setUploadingSpeakingPdf] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [questionEntryMode, setQuestionEntryMode] = useState<"manual" | "bulk">("manual");
  const examiner = SONIA_EXAMINER;
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showInfo = useToastStore((state) => state.showInfo);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  async function loadModule(preferredPartId?: number): Promise<ExamModulePart | null> {
    if (!id) return null;
    const showFullPageLoader = !module;
    if (showFullPageLoader) setLoading(true);
    try {
      const { data } = await apiClient.get<ExamModule>(`/instructor/modules/${id}`);
      setModule(data);
      const serverDetails: ModuleDetailsState = {
        title: data.title,
        description: data.description ?? "",
        instructions: data.instructions ?? "",
        duration_minutes: data.duration_minutes,
        show_onboarding_instructions: data.show_onboarding_instructions ?? true,
        onboarding_instructions: data.onboarding_instructions ?? [],
      };
      /* Take the server's version only when the author has nothing unsaved in
         the details form - otherwise a reload triggered by some other save
         (audio, questions, source text) would discard edits in progress,
         including anything typed into the candidate guidelines editor. */
      setDetails((current) => {
        const isCurrentEmpty = !current.title;
        const pristine = serverDetailsRef.current === null || isCurrentEmpty || isEqual(current, serverDetailsRef.current);
        serverDetailsRef.current = serverDetails;
        return pristine ? serverDetails : current;
      });

      const activePartKey = searchParams.get("part") || (id ? sessionStorage.getItem(`vh.module-editor.part.${id}`) : null);
      let selected: ExamModulePart | null = null;
      if (preferredPartId !== undefined) {
        selected = data.parts?.find((part) => part.id === preferredPartId) ?? null;
      } else if (activePartKey === "settings") {
        selected = null;
      } else if (activePartKey) {
        selected = data.parts?.find((part) => part.part_code === activePartKey || String(part.id) === activePartKey) ?? null;
      }
      if (!selected && activePartKey !== "settings") {
        selected = data.parts?.find((part) => part.id === selectedPartId) ?? data.parts?.[0] ?? null;
      }

      setSelectedPartId(selected?.id ?? null);
      if (id) {
        if (selected) {
          sessionStorage.setItem(`vh.module-editor.part.${id}`, selected.part_code || String(selected.id));
          setSearchParams({ part: selected.part_code || String(selected.id) }, { replace: true });
        } else if (activePartKey === "settings") {
          sessionStorage.setItem(`vh.module-editor.part.${id}`, "settings");
          setSearchParams({ part: "settings" }, { replace: true });
        }
      }

      /* Only seed the draft when there isn't one, or when the author has moved
         to a different part. loadModule() runs after every save - source text,
         audio, import, delete - and resetting here unconditionally wiped a
         half-written question every time any of those happened. Clearing the
         draft after a successful save is the job of the save handler, which
         already does it. */
      if (selected && (!manualPartIdRef.current || manualPartIdRef.current !== selected.id)) {
        manualPartIdRef.current = selected.id;
        setManual(emptyQuestion(selected));
      }
      setError(null);
      return selected;
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.details.errors.load));
      return null;
    } finally {
      if (showFullPageLoader) setLoading(false);
    }
  }

  const setCustomBreadcrumbs = usePageTitleStore((state) => state.setCustomBreadcrumbs);

  useEffect(() => { loadModule(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => {
    if (!isNew || !requestedType || !COMPOSITE_TYPES.has(requestedType)) return;
    setLoadingSources(true);
    apiClient.get<ExamModule[]>("/instructor/modules")
      .then(({ data }) => setSourceModules(data.filter((item) => SOURCE_SECTIONS.includes(item.module_type as ExamSection) && item.status !== "archived" && item.ready_to_publish)))
      .catch((err: unknown) => setError(extractErrorMessage(err, "Failed to load completed source modules.")))
      .finally(() => setLoadingSources(false));
  }, [isNew, requestedType]);

  useEffect(() => {
    if (!editingQuestionId) return;
    return lockBodyScroll();
  }, [editingQuestionId]);

  const selectedPart = useMemo(() => module?.parts?.find((part) => part.id === selectedPartId) ?? null, [module, selectedPartId]);
  /* Parts whose whole task is composed in one panel - a passage, a notepad, a
     set of source texts - rather than added question by question. The manual
     and bulk entry paths are hidden for them: the composer owns the rows. */
  const usesTaskComposer = COMPOSED_TASK_LAYOUTS.has(selectedPart?.answer_constraints.layout ?? "");
  /* A part holds exactly question_limit questions - there is no pool, so once
     it is full the only way forward is editing or deleting what is there. */
  const partIsFull = Boolean(
    selectedPart?.question_limit && selectedPart.questions.length >= selectedPart.question_limit,
  );
  const remainingSlots = selectedPart?.question_limit
    ? Math.max(0, selectedPart.question_limit - selectedPart.questions.length)
    : null;
  const [partTitle, setPartTitle] = useState("");

  /* Keyed on the part's id and its saved values rather than the object itself.
     `selectedPart` is derived from `module`, so it is a new object after every
     reload - depending on it re-ran this effect and wiped an edited section
     heading whenever anything else was saved. */
  useEffect(() => {
    if (selectedPart) {
      setPartTitle(selectedPart.title);
    } else {
      setPartTitle("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPart?.id, selectedPart?.title]);

  async function savePartHeader() {
    if (!module || !selectedPart) return;
    setBusy(true);
    setError(null);
    try {
      // Title only. PartSpecPanel owns instructions; sending them from here too
      // would let a stale copy overwrite whatever was saved there.
      await apiClient.patch(`/instructor/modules/${module.id}/parts/${selectedPart.id}`, {
        title: partTitle,
      });
      await loadModule(selectedPart.id);
      showSuccess("Section heading and instructions saved successfully.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to update section header."));
    } finally {
      setBusy(false);
    }
  }

  const detectedTtsSpeakers = useMemo(() => detectConversationSpeakers(tts.conversation), [tts.conversation]);
  const isEditable = module?.status !== "archived";
  const moduleWorkspacePath = useMemo(() => {
    if (location.pathname.startsWith("/institute-instructor/modules")) return "/institute-instructor/modules";
    return "/super-admin/instructor/modules";
  }, [location.pathname]);

  useEffect(() => {
    if (!module) return;
    setCustomBreadcrumbs([
      { label: "All Modules", path: moduleWorkspacePath },
      { label: module.module_label?.toUpperCase() || module.module_type?.toUpperCase() || "MODULE" },
      { label: module.title },
    ]);
    return () => setCustomBreadcrumbs(null);
  }, [module, moduleWorkspacePath, setCustomBreadcrumbs]);

  function choosePart(part: ExamModulePart | null) {
    if (!part) {
      setSelectedPartId(null);
      if (id) {
        sessionStorage.setItem(`vh.module-editor.part.${id}`, "settings");
        setSearchParams({ part: "settings" }, { replace: true });
      }
      setEditingQuestionId(null);
      setPreview(null);
      setImportFile(null);
      setError(null);
      document.getElementById("module-part-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSelectedPartId(part.id);
    if (id) {
      sessionStorage.setItem(`vh.module-editor.part.${id}`, part.part_code || String(part.id));
      setSearchParams({ part: part.part_code || String(part.id) }, { replace: true });
    }
    // Switching part legitimately starts a new draft; keep the ref in step so
    // the next reload does not think this draft belongs to the previous part.
    manualPartIdRef.current = part.id;
    setManual(emptyQuestion(part));
    setEditingQuestionId(null);
    setPreview(null);
    setImportFile(null);
    setError(null);
    document.getElementById("module-part-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createModule(event: FormEvent) {
    event.preventDefault();
    if (!requestedType) return;
    const isComposite = COMPOSITE_TYPES.has(requestedType);
    const sourceModuleIds = SOURCE_SECTIONS.map((section) => Number(selectedSources[section])).filter(Boolean);
    if (isComposite && sourceModuleIds.length !== SOURCE_SECTIONS.length) {
      setError(strings.newModule.validation);
      return;
    }
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModule>("/instructor/modules", {
        module_type: requestedType,
        title: details.title,
        description: details.description || null,
        instructions: details.instructions || null,
        ...(DERIVED_DURATION_MODULE_TYPES.has(requestedType) ? {} : { duration_minutes: details.duration_minutes }),
        show_onboarding_instructions: details.show_onboarding_instructions ?? true,
        onboarding_instructions: details.onboarding_instructions || null,
        source_module_ids: isComposite ? sourceModuleIds : [],
      });
      navigate(`${moduleWorkspacePath}/${data.id}`, { replace: true });
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.newModule.errors.create)); }
    finally { setBusy(false); }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault(); if (!module) return;
    const payload = {
      title: details.title,
      description: details.description || null,
      instructions: details.instructions || null,
      ...(DERIVED_DURATION_MODULE_TYPES.has(module.module_type) ? {} : { duration_minutes: details.duration_minutes }),
      show_onboarding_instructions: details.show_onboarding_instructions ?? true,
      onboarding_instructions: details.onboarding_instructions || null,
    };
    const original = {
      title: module.title,
      description: module.description || null,
      instructions: module.instructions || null,
      ...(DERIVED_DURATION_MODULE_TYPES.has(module.module_type) ? {} : { duration_minutes: module.duration_minutes }),
      show_onboarding_instructions: module.show_onboarding_instructions ?? true,
      onboarding_instructions: module.onboarding_instructions || null,
    };
    if (isEqual(original, payload)) { showInfo(noChangesMessage); return; }
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(`/instructor/modules/${module.id}`, payload);
      setModule(data); showSuccess(strings.details.notices.saved);
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.details.errors.save)); }
    finally { setBusy(false); }
  }

  function updateOption(index: number, text: string) {
    if (!manual) return;
    setManual({ ...manual, options: manual.options.map((option, current) => current === index ? { ...option, text } : option) });
  }

  function addOption() {
    if (!manual || !CHOICE_TYPES.has(manual.question_type) || manual.options.length >= 26) return;
    const key = String.fromCharCode(65 + manual.options.length);
    setManual({ ...manual, options: [...manual.options, { key, text: "" }] });
  }

  function removeOption(index: number) {
    if (!manual || !CHOICE_TYPES.has(manual.question_type) || manual.options.length <= 2) return;
    const remaining = manual.options.filter((_, current) => current !== index);
    const keyMap = new Map<string, string>();
    const options = remaining.map((option, nextIndex) => {
      const key = String.fromCharCode(65 + nextIndex);
      keyMap.set(option.key, key);
      return { ...option, key };
    });
    const correctAnswers = manual.correct_answers
      .map((answer) => keyMap.get(answer))
      .filter((answer): answer is string => Boolean(answer));
    setManual({
      ...manual,
      options,
      correct_answers: correctAnswers.length ? correctAnswers : [options[0]?.key ?? "A"],
    });
  }

  function toggleCorrect(key: string) {
    if (!manual) return;
    const answers = manual.question_type === "mcq_multiple"
      ? manual.correct_answers.includes(key) ? manual.correct_answers.filter((item) => item !== key) : [...manual.correct_answers, key]
      : [key];
    setManual({ ...manual, correct_answers: answers });
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !manual) return;
    if (selectedPart.part_code === "reading_1a" && !/\*\*(.+?)\*\*/.test(manual.prompt)) {
      showError(strings.manualQuestion.errors.boldRequired);
      return;
    }
    setBusy(true); setError(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      if (editingQuestionId) await apiClient.put(`${base}/${editingQuestionId}`, questionPayload(manual));
      else await apiClient.post(base, questionPayload(manual));
      const message = editingQuestionId ? strings.manualQuestion.notices.updated : strings.manualQuestion.notices.added(selectedPart.title);
      setEditingQuestionId(null);
      const freshPart = await loadModule(selectedPart.id);
      setManual(emptyQuestion(freshPart ?? selectedPart));
      showSuccess(message);
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.manualQuestion.errors.save)); }
    finally { setBusy(false); }
  }

  function editQuestion(question: ExamModuleQuestion) {
    setEditingQuestionId(question.id);
    const isPlaceholder = (text: string, key: string) =>
      text.trim().toLowerCase() === `option ${key.toLowerCase()}` ||
      text.trim().toLowerCase() === `option ${key}`.toLowerCase();

    setManual({
      question_type: question.question_type,
      prompt: question.prompt,
      instructions: question.instructions,
      passage: question.passage,
      image_path: question.image_path,
      image_url: question.image_url,
      options: (question.options || []).map((opt) => ({
        key: opt.key,
        text: isPlaceholder(opt.text, opt.key) ? "" : opt.text,
      })),
      correct_answers: question.correct_answers,
      interaction: question.interaction ?? {},
      explanation: question.explanation,
      points: question.points,
      difficulty: question.difficulty,
    });
  }

  async function uploadQuestionImage(file: File) {
    if (!module || !selectedPart) return;
    setUploadingImage(true); setError(null);
    try {
      const form = new FormData(); form.append("file", file);
      const { data } = await apiClient.post<{ image_path: string; image_url: string }>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/question-image`,
        form,
      );
      setManual((current) => current ? {
        ...current,
        image_path: data.image_path,
        image_url: data.image_url,
        interaction: selectedPart.section_type === "speaking" ? {
          ...(current.interaction || {}),
          candidate_material_type: "image",
          candidate_material_path: null,
          candidate_material_url: null,
          candidate_material_name: null,
        } : current.interaction,
      } : current);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.manualQuestion.errors.imageUpload));
    } finally {
      setUploadingImage(false);
    }
  }

  function removeQuestionImage() {
    setManual((current) => current ? { ...current, image_path: null, image_url: null } : current);
  }

  async function uploadSpeakingMaterialPdf(file: File) {
    if (!module || !selectedPart) return;
    setUploadingSpeakingPdf(true); setError(null);
    try {
      const form = new FormData(); form.append("file", file);
      const { data } = await apiClient.post<{
        candidate_material_path: string;
        candidate_material_url: string;
        candidate_material_name: string;
      }>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/speaking-material-pdf`, form);
      setManual((current) => current ? {
        ...current,
        image_path: null,
        image_url: null,
        interaction: {
          ...(current.interaction || {}),
          candidate_material_type: "pdf",
          candidate_material_path: data.candidate_material_path,
          candidate_material_url: data.candidate_material_url,
          candidate_material_name: data.candidate_material_name,
        },
      } : current);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to upload candidate PDF material"));
    } finally {
      setUploadingSpeakingPdf(false);
    }
  }

  function removeSpeakingMaterialPdf() {
    setManual((current) => current ? {
      ...current,
      interaction: {
        ...(current.interaction || {}),
        candidate_material_path: null,
        candidate_material_url: null,
        candidate_material_name: null,
      },
    } : current);
  }

  async function uploadQuestionAudio(file: File) {
    if (!module || !selectedPart) return;
    setUploadingAudio(true); setError(null);
    try {
      const form = new FormData(); form.append("file", file);
      const { data } = await apiClient.post<{ audio_path: string; audio_url: string }>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/question-audio`,
        form,
      );
      setManual((current) => current ? {
        ...current,
        interaction: { ...(current.interaction || {}), audio_path: data.audio_path, audio_url: data.audio_url },
      } : current);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to upload question audio clip"));
    } finally {
      setUploadingAudio(false);
    }
  }

  function removeQuestionAudio() {
    setManual((current) => {
      if (!current) return current;
      const nextInteraction = { ...(current.interaction || {}) };
      delete nextInteraction.audio_path;
      delete nextInteraction.audio_url;
      return { ...current, interaction: nextInteraction };
    });
  }

  async function deleteQuestion(question: ExamModuleQuestion) {
    if (!module || !selectedPart || !await confirmDelete(strings.manualQuestion.deleteConfirm, strings.manualQuestion.deleteConfirmTitle)) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/parts/${selectedPart.id}/questions/${question.id}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.manualQuestion.errors.delete)); }
  }

  async function previewImport(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !importFile) return;
    setBusy(true); setError(null); setPreview(null);
    try {
      const form = new FormData(); form.append("file", importFile);
      const { data } = await apiClient.post<QuestionImportPreview>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/import-preview`, form);
      const allowed = selectedPart.answer_constraints.allowed_question_types ?? [];
      const groupSize = selectedPart.answer_constraints.questions_per_group ?? 1;
      const normalized = data.questions.map((question, index) => {
        const nextType = !allowed.length || allowed.includes(question.question_type) ? question.question_type : allowed[0];
        const turnType = question.interaction?.turn_type
          ?? defaultSpeakingTurn(selectedPart, index);
        return {
          ...question,
          question_type: nextType,
          prompt: selectedPart.answer_constraints.inline_marker_required && !question.prompt.includes("{{blank}}")
            ? `${question.prompt} {{blank}}`
            : question.prompt,
          options: CHOICE_TYPES.has(nextType) ? question.options : [],
          correct_answers: ANSWER_FREE_TYPES.has(nextType) ? [] : question.correct_answers,
          interaction: {
            ...question.interaction,
            group_label: question.interaction?.group_label
              ?? (selectedPart.answer_constraints.group_label_required ? `Conversation ${Math.floor(index / groupSize) + 1}` : null),
            turn_type: turnType,
            // Timing is per prompt and has no part-level default to inherit.
            // An import that carries none leaves these null, and the prompt
            // cannot be saved until the author sets them.
            preparation_seconds: question.interaction?.preparation_seconds ?? null,
            response_seconds: question.interaction?.response_seconds ?? null,
            adaptive_follow_up: question.interaction?.adaptive_follow_up ?? turnType === "follow_up",
          },
        };
      });
      const requiredPoints = selectedPart.max_marks && selectedPart.question_limit ? Number(selectedPart.max_marks) / selectedPart.question_limit : null;
      setPreview({ ...data, questions: normalized.map((question) => requiredPoints === null ? question : { ...question, points: requiredPoints }) });
      setSelectedImports(new Set(normalized.map((_, index) => index)));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.bulkImport.errors.preview)); }
    finally { setBusy(false); }
  }

  function updatePreview(index: number, changes: Partial<QuestionDraft>) {
    setPreview((current) => current ? { ...current, questions: current.questions.map((question, currentIndex) => currentIndex === index ? { ...question, ...changes } : question) } : current);
  }

  async function commitImport() {
    if (!module || !selectedPart || !preview) return;
    const questions = preview.questions.filter((_, index) => selectedImports.has(index)).map(questionPayload);
    if (!questions.length) { showError(strings.bulkImport.errors.selectOne); return; }
    // Catch an over-selection here so the author can deselect rows, rather than
    // sending a batch the part-size cap will reject wholesale.
    if (remainingSlots !== null && questions.length > remainingSlots) {
      showError(strings.bulkImport.errors.tooMany(questions.length, remainingSlots, selectedPart.title));
      return;
    }
    setBusy(true); setError(null);
    try {
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/import`, { source_type: preview.source_type, source_filename: preview.source_filename, questions });
      setPreview(null); setImportFile(null); await loadModule(selectedPart.id); showSuccess(strings.bulkImport.notices.imported(questions.length, selectedPart.title));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.bulkImport.errors.commit)); }
    finally { setBusy(false); }
  }

  async function uploadAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !audioFile) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.append("title", audioTitle); form.append("file", audioFile);
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/audio`, form);
      setAudioFile(null); await loadModule(selectedPart.id); showSuccess(strings.listeningAudio.notices.uploaded(selectedPart.title));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.upload)); }
    finally { setBusy(false); }
  }

  async function togglePartAiEvaluation(enabled: boolean) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/ai-evaluation`,
        { ai_evaluation_enabled: enabled },
      );
      setModule(data);
      showSuccess(strings.partSpec.aiEvaluationSaved(selectedPart.title, enabled));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.partSpec.aiEvaluationError));
    } finally {
      setBusy(false);
    }
  }

  async function updatePartInstructions(instructions: string) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/instructions`,
        { instructions: instructions.trim() || null },
      );
      setModule(data);
      showSuccess(strings.partSpec.instructionsSaved(selectedPart.title));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.partSpec.instructionsError));
    } finally {
      setBusy(false);
    }
  }

  async function generateAudio(payload: { title: string; conversation: string; rate: string }) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const existingTts = selectedPart.assets.filter(a => a.asset_type === "tts_text");
      for (const asset of existingTts) {
        await apiClient.delete(`/instructor/modules/${module.id}/assets/${asset.id}`);
      }
      const { data } = await apiClient.post<ExamModuleAsset>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/tts`, payload);
      await loadModule(selectedPart.id); showSuccess(strings.listeningAudio.notices.generated(data.tts_voice ?? "", selectedPart.title));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.generate)); }
    finally { setBusy(false); }
  }

  async function deleteAudio(assetId: number) {
    if (!module || !selectedPart || !await confirmDelete("Are you sure you want to delete this audio file?", "Delete Audio File")) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/assets/${assetId}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.delete)); }
  }

  // Source-text matching: the texts are the option bank, and each statement
  // becomes one scorable row. A statement with two or more keys is saved as
  // mcq_multiple, which marks on an exact set match.
  async function saveSourceTextTask(draft: SourceTextDraft) {
    if (!module || !selectedPart) return;
    if (selectedPart.questions.length > 0) {
      const confirmed = await confirmDelete(
        strings.sourceTextTask.replaceConfirm(selectedPart.questions.length),
        strings.sourceTextTask.replaceConfirmTitle,
      );
      if (!confirmed) return;
    }
    setBusy(true); setError(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      const passage = draft.texts.map((item) => `${item.key}. ${item.text}`).join("\n\n");
      const points = selectedPart.max_marks && draft.questions.length
        ? Number(selectedPart.max_marks) / draft.questions.length
        : 1;

      const existing = selectedPart.questions;
      for (let i = 0; i < draft.questions.length; i++) {
        const question = draft.questions[i];
        const payload = questionPayload({
          question_type: question.answers.length > 1 ? "mcq_multiple" : "matching_reusable",
          prompt: question.prompt,
          instructions: null,
          passage,
          image_path: null,
          image_url: null,
          options: draft.texts,
          correct_answers: question.answers,
          interaction: {},
          explanation: null,
          points,
          difficulty: "medium",
        });

        if (i < existing.length) {
          await apiClient.put(`${base}/${existing[i].id}`, payload);
        } else {
          await apiClient.post(base, payload);
        }
      }

      if (draft.questions.length < existing.length) {
        for (let i = draft.questions.length; i < existing.length; i++) {
          await apiClient.delete(`${base}/${existing[i].id}`);
        }
      }

      await loadModule(selectedPart.id);
      showSuccess(strings.sourceTextTask.saved(draft.questions.length));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.sourceTextTask.error));
    } finally {
      setBusy(false);
    }
  }

  // Generates one question per gap from a single composed task. The rows are
  // what make each gap independently scorable; composing them by hand is what
  // led to a whole task being saved as one question worth one mark.
  async function saveGapTask(draft: GapTaskDraft) {
    if (!module || !selectedPart) return;
    const gaps = Object.keys(draft.answers).map(Number).sort((a, b) => a - b);
    if (selectedPart.questions.length > 0) {
      const confirmed = await confirmDelete(
        strings.gapTask.replaceConfirm(selectedPart.questions.length),
        strings.gapTask.replaceConfirmTitle,
      );
      if (!confirmed) return;
    }
    setBusy(true); setError(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      const points = selectedPart.max_marks && gaps.length
        ? Number(selectedPart.max_marks) / gaps.length
        : 1;

      const existing = selectedPart.questions;
      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        const payload = questionPayload({
          question_type: selectedPart.answer_constraints.allowed_question_types?.[0] ?? "matching_unique",
          prompt: strings.gapTask.gapLabel(gap),
          instructions: null,
          passage: draft.passage,
          image_path: null,
          image_url: null,
          options: draft.options,
          correct_answers: [draft.answers[gap]],
          interaction: {},
          explanation: null,
          points,
          difficulty: "medium",
        });

        if (i < existing.length) {
          await apiClient.put(`${base}/${existing[i].id}`, payload);
        } else {
          await apiClient.post(base, payload);
        }
      }

      if (gaps.length < existing.length) {
        for (let i = gaps.length; i < existing.length; i++) {
          await apiClient.delete(`${base}/${existing[i].id}`);
        }
      }

      await loadModule(selectedPart.id);
      showSuccess(strings.gapTask.saved(gaps.length));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.gapTask.error));
    } finally {
      setBusy(false);
    }
  }

  // Listening 3 is one notepad, not seven questions: the author writes it once
  // and this generates the scorable row behind each blank. Every row carries the
  // whole notepad on `passage` - that is what the candidate reads - and its own
  // line as the prompt, which is what satisfies the part's {{blank}} rule.
  async function saveNotepadTask(draft: NotepadTaskDraft) {
    if (!module || !selectedPart) return;
    const blanks = Object.keys(draft.answers).map(Number).sort((a, b) => a - b);
    setBusy(true); setError(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      const points = selectedPart.max_marks && blanks.length
        ? Number(selectedPart.max_marks) / blanks.length
        : 1;

      const existing = selectedPart.questions;
      for (let i = 0; i < blanks.length; i++) {
        const blank = blanks[i];
        const payload = questionPayload({
          question_type: selectedPart.answer_constraints.allowed_question_types?.[0] ?? "fill_blank",
          prompt: notepadPromptForBlank(draft.notepad, blank),
          instructions: null,
          passage: draft.notepad,
          image_path: null,
          image_url: null,
          options: [],
          correct_answers: draft.answers[blank],
          interaction: {},
          explanation: null,
          points,
          difficulty: "medium",
        });

        if (i < existing.length) {
          await apiClient.put(`${base}/${existing[i].id}`, payload);
        } else {
          await apiClient.post(base, payload);
        }
      }

      if (blanks.length < existing.length) {
        for (let i = blanks.length; i < existing.length; i++) {
          await apiClient.delete(`${base}/${existing[i].id}`);
        }
      }

      await loadModule(selectedPart.id);
      showSuccess(strings.notepadTask.saved(blanks.length));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.notepadTask.error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteComposedTask() {
    if (!module || !selectedPart) return;
    const count = selectedPart.questions.length;
    const confirmed = await confirmDelete(
      `Are you sure you want to delete this ${selectedPart.title} task and all of its ${count} questions?`,
      "Delete Task"
    );
    if (!confirmed) return;
    setBusy(true); setError(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      for (const question of selectedPart.questions) {
        await apiClient.delete(`${base}/${question.id}`);
      }
      await loadModule(selectedPart.id);
      showSuccess("Task deleted successfully.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to delete task."));
    } finally {
      setBusy(false);
    }
  }

  // The passage lives on each question, so saving the part-level source text
  // rewrites every question in the part. Questions are re-sent whole because the
  // update endpoint takes a full QuestionCreate payload, not a patch.
  async function saveSharedPassage(passage: string) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(`vh.passage.${selectedPart.id}`, passage);
      }
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      if (selectedPart.questions.length > 0) {
        for (const question of selectedPart.questions) {
          await apiClient.put(
            `${base}/${question.id}`,
            questionPayload({
              question_type: question.question_type,
              prompt: question.prompt,
              instructions: question.instructions,
              passage,
              image_path: question.image_path,
              image_url: question.image_url,
              options: question.options,
              correct_answers: question.correct_answers,
              interaction: question.interaction ?? {},
              explanation: question.explanation,
              points: question.points,
              difficulty: question.difficulty,
            }),
          );
        }
      }
      const partId = selectedPart.id;
      await loadModule(partId);
      // Keep the in-progress draft in step so the next question inherits it.
      setManual((current) => (current ? { ...current, passage } : current));
      showSuccess(strings.sharedPassage.saved(selectedPart.title));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.sharedPassage.error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSharedPassage() {
    if (!module || !selectedPart) return;
    const confirmed = await confirmDelete(
      `Are you sure you want to delete the shared source text for ${selectedPart.title}?`,
      "Delete Source Text"
    );
    if (!confirmed) return;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(`vh.passage.${selectedPart.id}`);
    }
    await saveSharedPassage("");
    showSuccess("Source text deleted successfully.");
  }

  async function changeStatus(status: "draft" | "published" | "archived") {
    if (!module) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModule>(`/instructor/modules/${module.id}/status`, { status });
      setModule(data); showSuccess(status === "published" ? strings.details.notices.published : strings.details.notices.movedTo(status));
      // Publishing ends the authoring job, so hand the author back to the
      // module list rather than leaving them in an editor for finished work.
      if (status === "published") navigate(moduleWorkspacePath);
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.details.notices.statusError)); }
    finally { setBusy(false); }
  }

  async function deleteModule() {
    if (!module || !await confirmDelete(strings.details.deleteConfirm(module.title), strings.details.deleteConfirmTitle)) return;
    setBusy(true); setError(null);
    try { await apiClient.delete(`/instructor/modules/${module.id}`); navigate(moduleWorkspacePath); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.details.errors.delete)); }
    finally { setBusy(false); }
  }

  if (isNew) {
    return (
      <NewModuleForm
        requestedType={requestedType}
        details={details}
        onDetailsChange={setDetails}
        sourceModules={sourceModules}
        selectedSources={selectedSources}
        onSelectedSourcesChange={setSelectedSources}
        loadingSources={loadingSources}
        busy={busy}
        error={error}
        moduleWorkspacePath={moduleWorkspacePath}
        onSubmit={createModule}
      />
    );
  }

  if (loading) return <p>{strings.loading}</p>;
  if (!module) return <div><p className="error-text">{error || strings.notFound}</p><Link to={moduleWorkspacePath}>{strings.backToModules}</Link></div>;

  return (
    <div className="module-editor-page">
      {/* Sleek Bottom Floating Status Bar */}
      <div className="vh-bottom-floating-status-bar">
        <ModuleReadinessPanel module={module} busy={busy} onChangeStatus={changeStatus} onChoosePart={choosePart} />
        <Badge tone={module.status === "published" ? "green" : module.status === "archived" ? "gray" : "amber"}>
          {module.status}
        </Badge>
      </div>

      <div className="module-authoring-layout">
        <div className="module-authoring-sticky-stack">
          <ModulePartNav
            parts={module.parts}
            selectedPartId={selectedPartId}
            onChoosePart={choosePart}
          />
        </div>
        <main className="module-part-editor" id="module-part-editor">
          {!selectedPart ? (
            <ModuleDetailsForm
              module={module}
              details={details}
              onDetailsChange={setDetails}
              isEditable={isEditable}
              busy={busy}
              onSubmit={saveDetails}
              onDelete={deleteModule}
            />
          ) : (
            <>
              {/* The section heading is edited inline in this header. Candidate
                  instructions live here too - having them in two places meant
                  two fields writing the same column, where whichever you saved
                  last silently overwrote the other. */}
              <PartSpecPanel
                part={selectedPart}
                isEditable={isEditable}
                busy={busy}
                onToggleAiEvaluation={togglePartAiEvaluation}
                onUpdateInstructions={updatePartInstructions}
                partTitle={partTitle}
                onPartTitleChange={setPartTitle}
                onSavePartTitle={savePartHeader}
                {...(usesTaskComposer ? {} : {
                  questionEntryMode,
                  onEntryModeChange: setQuestionEntryMode,
                })}
              />

            {selectedPart.section_type === "listening" && (
              <ListeningAudioPanel
                part={selectedPart}
                isEditable={isEditable}
                audioTitle={audioTitle}
                onAudioTitleChange={setAudioTitle}
                onAudioFileChange={setAudioFile}
                onUploadAudio={uploadAudio}
                tts={tts}
                onTtsChange={setTts}
                detectedTtsSpeakers={detectedTtsSpeakers}
                onGenerateAudio={generateAudio}
                busy={busy}
                audioFile={audioFile}
                onDeleteAudio={deleteAudio}
              />
            )}

            {selectedPart.answer_constraints.layout === "source_text_matching" ? (
              <SourceTextComposer
                part={selectedPart}
                isEditable={isEditable}
                busy={busy}
                onSubmit={saveSourceTextTask}
              />
            ) : null}

            {selectedPart.answer_constraints.layout === "inline_matching_blanks" ? (
              <GapTaskComposer
                part={selectedPart}
                isEditable={isEditable}
                busy={busy}
                onSubmit={saveGapTask}
                onSavePassage={saveSharedPassage}
                onDeletePassage={deleteSharedPassage}
              />
            ) : null}

            {selectedPart.answer_constraints.layout === "notepad_gaps" ? (
              <NotepadGapsComposer
                part={selectedPart}
                isEditable={isEditable}
                busy={busy}
                onSubmit={saveNotepadTask}
                onDelete={deleteComposedTask}
              />
            ) : null}

            {selectedPart.answer_constraints.shared_passage && !usesTaskComposer && (
              <SharedPassagePanel
                part={selectedPart}
                isEditable={isEditable}
                busy={busy}
                onSave={saveSharedPassage}
                onDelete={deleteSharedPassage}
              />
            )}

            {isEditable && partIsFull && !usesTaskComposer && !editingQuestionId && (
              <div className="empty-state compact-empty">
                <h2>{strings.manualQuestion.partFullHeading(selectedPart.title)}</h2>
                <p>{strings.manualQuestion.partFullBody(selectedPart.question_limit ?? 0)}</p>
              </div>
            )}

            {isEditable && manual && !usesTaskComposer && !partIsFull && (
              <div className="vh-entry-mode-wrapper">
                <div className="module-entry-tabbed-content">
                  {questionEntryMode === "manual" || selectedPart.section_type === "writing" || selectedPart.part_code.startsWith("writing_") ? (
                    <ManualQuestionForm
                      moduleId={module.id}
                      examiner={examiner}
                      part={selectedPart}
                      manual={manual}
                      editingQuestionId={editingQuestionId}
                      busy={busy}
                      uploadingImage={uploadingImage}
                      uploadingSpeakingPdf={uploadingSpeakingPdf}
                      uploadingAudio={uploadingAudio}
                      onAddOption={addOption}
                      onRemoveOption={removeOption}
                      onUpdateOption={updateOption}
                      onToggleCorrect={toggleCorrect}
                      onManualChange={setManual}
                      onUploadImage={uploadQuestionImage}
                      onRemoveImage={removeQuestionImage}
                      onUploadSpeakingPdf={uploadSpeakingMaterialPdf}
                      onRemoveSpeakingPdf={removeSpeakingMaterialPdf}
                      onUploadAudio={uploadQuestionAudio}
                      onRemoveAudio={removeQuestionAudio}
                      onSubmit={saveQuestion}
                      onCancelEdit={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}
                    />
                  ) : (
                    <BulkImportForm module={module} part={selectedPart} importFile={importFile} onImportFileChange={setImportFile} busy={busy} onSubmit={previewImport} />
                  )}
                </div>
              </div>
            )}

            {preview && (
              <ImportReviewPanel
                module={module}
                part={selectedPart}
                preview={preview}
                selectedImports={selectedImports}
                onSelectedImportsChange={setSelectedImports}
                onUpdatePreview={updatePreview}
                onDiscard={() => setPreview(null)}
                onCommit={commitImport}
                busy={busy}
              />
            )}

              {/* A composed task already shows every row it generated, with its
                  answer, inside its own panel - and editing or deleting one row
                  on its own would only break the task the composer rebuilds. */}
              {!usesTaskComposer && (
                <SavedQuestionsList part={selectedPart} isEditable={isEditable} onEdit={editQuestion} onDelete={deleteQuestion} />
              )}
            </>
          )}
        </main>
      </div>

      {editingQuestionId && selectedPart && manual && (
        <div className="modal-backdrop" onClick={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "95vh", overflowY: "auto", padding: 0, border: "none", background: "transparent", boxShadow: "none" }}>
            <ManualQuestionForm
              moduleId={module.id}
              examiner={examiner}
              part={selectedPart}
              manual={manual}
              editingQuestionId={editingQuestionId}
              busy={busy}
              uploadingImage={uploadingImage}
              uploadingSpeakingPdf={uploadingSpeakingPdf}
              uploadingAudio={uploadingAudio}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onUpdateOption={updateOption}
              onToggleCorrect={toggleCorrect}
              onManualChange={setManual}
              onUploadImage={uploadQuestionImage}
              onRemoveImage={removeQuestionImage}
              onUploadSpeakingPdf={uploadSpeakingMaterialPdf}
              onRemoveSpeakingPdf={removeSpeakingMaterialPdf}
              onUploadAudio={uploadQuestionAudio}
              onRemoveAudio={removeQuestionAudio}
              onSubmit={saveQuestion}
              onCancelEdit={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
