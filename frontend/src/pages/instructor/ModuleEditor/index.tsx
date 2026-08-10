import { type FormEvent, useEffect, useMemo, useState } from "react";
import { lockBodyScroll } from "@/utils/scrollLock";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { confirmDelete } from "@/components/confirmDialog";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import type {
  ExamModule,
  ExamModuleAsset,
  ExamModulePart,
  ExamModuleQuestion,
  ExamModuleType,
  IeltsSection,
  QuestionDraft,
  QuestionImportPreview,
} from "@/api/types";
import { moduleEditorStrings as strings } from "./ModuleEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES, COMPOSITE_TYPES, MODULE_TYPES, SOURCE_SECTIONS, detectConversationSpeakers, emptyQuestion, questionPayload } from "./helpers";
import { NewModuleForm } from "./components/NewModuleForm";
import { ModulePartNav } from "./components/ModulePartNav";
import { ModuleReadinessPanel } from "./components/ModuleReadinessPanel";
import { ModuleDetailsForm, type ModuleDetailsState } from "./components/ModuleDetailsForm";
import { PartSpecPanel } from "./components/PartSpecPanel";
import { ListeningAudioPanel } from "./components/ListeningAudioPanel";
import { SpeakingTimingPanel } from "./components/SpeakingTimingPanel";
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
  const requestedType = rawType && MODULE_TYPES.has(rawType as ExamModuleType) ? rawType as ExamModuleType : null;
  const [module, setModule] = useState<ExamModule | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [details, setDetails] = useState<ModuleDetailsState>({ title: "", description: "", instructions: "", duration_minutes: 1, show_onboarding_instructions: true, onboarding_instructions: [] });
  const [sourceModules, setSourceModules] = useState<ExamModule[]>([]);
  const [selectedSources, setSelectedSources] = useState<Record<IeltsSection, string>>({ listening: "", reading: "", writing: "", speaking: "" });
  const [loadingSources, setLoadingSources] = useState(false);
  const [manual, setManual] = useState<QuestionDraft | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<QuestionImportPreview | null>(null);
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTitle, setAudioTitle] = useState("Listening audio");
  const [tts, setTts] = useState({ title: "Generated conversation", conversation: "", rate: "+0%" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [questionEntryMode, setQuestionEntryMode] = useState<"manual" | "bulk">("manual");
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showInfo = useToastStore((state) => state.showInfo);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  async function loadModule(preferredPartId?: number) {
    if (!id) return;
    const showFullPageLoader = !module;
    if (showFullPageLoader) setLoading(true);
    try {
      const { data } = await apiClient.get<ExamModule>(`/instructor/modules/${id}`);
      setModule(data);
      setDetails({
        title: data.title,
        description: data.description ?? "",
        instructions: data.instructions ?? "",
        duration_minutes: data.duration_minutes,
        show_onboarding_instructions: data.show_onboarding_instructions ?? true,
        onboarding_instructions: data.onboarding_instructions ?? [],
      });
      const selected = data.parts?.find((part) => part.id === (preferredPartId ?? selectedPartId)) ?? data.parts?.[0] ?? null;
      setSelectedPartId(selected?.id ?? null);
      if (selected) setManual(emptyQuestion(selected));
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.details.errors.load));
    } finally {
      if (showFullPageLoader) setLoading(false);
    }
  }

  useEffect(() => { loadModule(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => {
    if (!isNew || !requestedType || !COMPOSITE_TYPES.has(requestedType)) return;
    setLoadingSources(true);
    apiClient.get<ExamModule[]>("/instructor/modules")
      .then(({ data }) => setSourceModules(data.filter((item) => SOURCE_SECTIONS.includes(item.module_type as IeltsSection) && item.status !== "archived" && item.ready_to_publish)))
      .catch((err: unknown) => setError(extractErrorMessage(err, "Failed to load completed source modules.")))
      .finally(() => setLoadingSources(false));
  }, [isNew, requestedType]);

  useEffect(() => {
    if (!editingQuestionId) return;
    return lockBodyScroll();
  }, [editingQuestionId]);

  const selectedPart = useMemo(() => module?.parts?.find((part) => part.id === selectedPartId) ?? null, [module, selectedPartId]);
  const detectedTtsSpeakers = useMemo(() => detectConversationSpeakers(tts.conversation), [tts.conversation]);
  const isEditable = module?.status !== "archived";
  const moduleWorkspacePath = useMemo(() => {
    if (location.pathname.startsWith("/institute-instructor/modules")) return "/institute-instructor/modules";
    return "/super-admin/instructor/modules";
  }, [location.pathname]);

  function choosePart(part: ExamModulePart | null) {
    if (!part) {
      setSelectedPartId(null);
      setEditingQuestionId(null);
      setPreview(null);
      setImportFile(null);
      setError(null);
      document.getElementById("module-part-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSelectedPartId(part.id);
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
        duration_minutes: details.duration_minutes,
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
      duration_minutes: details.duration_minutes,
      show_onboarding_instructions: details.show_onboarding_instructions ?? true,
      onboarding_instructions: details.onboarding_instructions || null,
    };
    const original = {
      title: module.title,
      description: module.description || null,
      instructions: module.instructions || null,
      duration_minutes: module.duration_minutes,
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
    setBusy(true); setError(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      if (editingQuestionId) await apiClient.put(`${base}/${editingQuestionId}`, questionPayload(manual));
      else await apiClient.post(base, questionPayload(manual));
      const message = editingQuestionId ? strings.manualQuestion.notices.updated : strings.manualQuestion.notices.added(selectedPart.title);
      setEditingQuestionId(null); setManual(emptyQuestion(selectedPart));
      await loadModule(selectedPart.id); showSuccess(message);
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.manualQuestion.errors.save)); }
    finally { setBusy(false); }
  }

  function editQuestion(question: ExamModuleQuestion) {
    setEditingQuestionId(question.id);
    setManual({ question_type: question.question_type, prompt: question.prompt, instructions: question.instructions, passage: question.passage, image_path: question.image_path, image_url: question.image_url, options: question.options, correct_answers: question.correct_answers, interaction: question.interaction ?? {}, explanation: question.explanation, points: question.points, difficulty: question.difficulty });
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
      setManual((current) => current ? { ...current, image_path: data.image_path, image_url: data.image_url } : current);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.manualQuestion.errors.imageUpload));
    } finally {
      setUploadingImage(false);
    }
  }

  function removeQuestionImage() {
    setManual((current) => current ? { ...current, image_path: null, image_url: null } : current);
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
      const requiredTurns = selectedPart.answer_constraints.required_turn_types ?? [];
      const groupSize = selectedPart.answer_constraints.questions_per_group ?? 1;
      const normalized = data.questions.map((question, index) => {
        const nextType = !allowed.length || allowed.includes(question.question_type) ? question.question_type : allowed[0];
        const turnType = question.interaction?.turn_type
          ?? requiredTurns[Math.min(index, requiredTurns.length - 1)]
          ?? selectedPart.answer_constraints.allowed_turn_types?.[0]
          ?? null;
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
            preparation_seconds: question.interaction?.preparation_seconds ?? selectedPart.answer_constraints.preparation_seconds ?? null,
            response_seconds: question.interaction?.response_seconds ?? selectedPart.answer_constraints.response_seconds ?? null,
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

  async function saveSpeakingTiming(preparationSeconds: number, responseSeconds: number) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/speaking-timing`,
        { preparation_seconds: preparationSeconds, response_seconds: responseSeconds },
      );
      setModule(data);
      showSuccess(strings.speakingTiming.saved(selectedPart.title));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.speakingTiming.error));
    } finally {
      setBusy(false);
    }
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

  async function generateAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModuleAsset>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/tts`, tts);
      setTts((current) => ({ ...current, conversation: "" })); await loadModule(selectedPart.id); showSuccess(strings.listeningAudio.notices.generated(data.tts_voice ?? "", selectedPart.title));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.generate)); }
    finally { setBusy(false); }
  }

  async function deleteAudio(assetId: number) {
    if (!module || !selectedPart || !await confirmDelete("Are you sure you want to delete this audio file?", "Delete Audio File")) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/assets/${assetId}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.delete)); }
  }

  async function changeStatus(status: "draft" | "published" | "archived") {
    if (!module) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModule>(`/instructor/modules/${module.id}/status`, { status });
      setModule(data); showSuccess(status === "published" ? strings.details.notices.published : strings.details.notices.movedTo(status));
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
  async function runReadingAutoFill() {
    if (!module) return;
    setBusy(true);
    try {
      const partsMap = module.parts || [];
      const part1a = partsMap.find(p => p.part_code === "reading_1a");
      const part1b = partsMap.find(p => p.part_code === "reading_1b");
      const part2 = partsMap.find(p => p.part_code === "reading_2");
      const part3 = partsMap.find(p => p.part_code === "reading_3");
      const part4 = partsMap.find(p => p.part_code === "reading_4");

      if (part1a) {
        const q1a = [
          {
            prompt: "The committee's findings were largely ______ with those of the earlier study, which strengthened confidence in both sets of results.",
            options: [{"key": "A", "text": "consistent"}, {"key": "B", "text": "persistent"}, {"key": "C", "text": "insistent"}, {"key": "D", "text": "resistant"}],
            correct_answers: ["A"]
          },
          {
            prompt: "Rather than stating her objection openly, she chose to ______ her disagreement in a series of carefully worded questions.",
            options: [{"key": "A", "text": "announce"}, {"key": "B", "text": "veil"}, {"key": "C", "text": "broadcast"}, {"key": "D", "text": "inflate"}],
            correct_answers: ["B"]
          },
          {
            prompt: "The report was criticised for relying on ______ evidence — a handful of memorable stories rather than systematic data.",
            options: [{"key": "A", "text": "empirical"}, {"key": "B", "text": "statistical"}, {"key": "C", "text": "anecdotal"}, {"key": "D", "text": "theoretical"}],
            correct_answers: ["C"]
          },
          {
            prompt: "Funding for the project was ______ on the team publishing its interim results by the end of the year.",
            options: [{"key": "A", "text": "contingent"}, {"key": "B", "text": "reluctant"}, {"key": "C", "text": "redundant"}, {"key": "D", "text": "abundant"}],
            correct_answers: ["A"]
          },
          {
            prompt: "Although the two theories appear similar, a closer reading reveals a ______ but important difference in how each defines \"value\".",
            options: [{"key": "A", "text": "blatant"}, {"key": "B", "text": "subtle"}, {"key": "C", "text": "drastic"}, {"key": "D", "text": "profound"}],
            correct_answers: ["B"]
          },
          {
            prompt: "The museum's new wing was designed to ______ the original building rather than compete with it.",
            options: [{"key": "A", "text": "complement"}, {"key": "B", "text": "compliment"}, {"key": "C", "text": "compensate"}, {"key": "D", "text": "compile"}],
            correct_answers: ["A"]
          }
        ];
        for (const q of q1a) {
          await apiClient.post(`/instructor/modules/${module.id}/parts/${part1a.id}/questions`, {
            question_type: "mcq_single",
            prompt: q.prompt,
            instructions: "Choose the correct word.",
            options: q.options,
            correct_answers: q.correct_answers,
            points: 1.0,
            difficulty: "medium",
            source_type: "manual",
            interaction: {}
          });
        }
      }

      if (part1b) {
        const passage_1b = `Rethinking the office\n\nFor most of the twentieth century, the open-plan office was presented as a straightforward improvement on the private room. Removing walls, it was argued, would encourage the informal exchanges from which good ideas (1) ______. Employers were also drawn to the lower cost per employee.\n\nRecent research has complicated that picture. When one firm converted two floors to open plan, face-to-face interaction (2) ______ by roughly seventy per cent, while email traffic rose. Rather than talking more, staff appeared to retreat behind headphones and screens.\n\nThe explanation may lie in privacy. In a room with no barriers, a conversation is (3) ______ to everyone within earshot, and workers seem to compensate by having fewer of them. Concentration suffers too: studies of interrupted work suggest it can take twenty minutes to (4) ______ full focus after a distraction.\n\nNone of this means the open plan should be abandoned. It suggests instead that a single layout is unlikely to suit every kind of work, and that offices should offer a (5) ______ of spaces — quiet rooms for concentration alongside open areas for collaboration.`;
        const q1b = [
          { prompt: "Choose the best option for gap (1).", options: [{"key": "A", "text": "emerge"}, {"key": "B", "text": "emerged"}, {"key": "C", "text": "emergency"}], correct_answers: ["A"] },
          { prompt: "Choose the best option for gap (2).", options: [{"key": "A", "text": "declined"}, {"key": "B", "text": "reduced"}, {"key": "C", "text": "lessened"}], correct_answers: ["A"] },
          { prompt: "Choose the best option for gap (3).", options: [{"key": "A", "text": "audible"}, {"key": "B", "text": "audio"}, {"key": "C", "text": "auditory"}], correct_answers: ["A"] },
          { prompt: "Choose the best option for gap (4).", options: [{"key": "A", "text": "regain"}, {"key": "B", "text": "return"}, {"key": "C", "text": "restore"}], correct_answers: ["A"] },
          { prompt: "Choose the best option for gap (5).", options: [{"key": "A", "text": "range"}, {"key": "B", "text": "row"}, {"key": "C", "text": "rank"}], correct_answers: ["A"] }
        ];
        for (const q of q1b) {
          await apiClient.post(`/instructor/modules/${module.id}/parts/${part1b.id}/questions`, {
            question_type: "mcq_single",
            prompt: q.prompt,
            instructions: "Choose the correct answer for the gap.",
            passage: passage_1b,
            options: q.options,
            correct_answers: q.correct_answers,
            points: 1.0,
            difficulty: "medium",
            source_type: "manual",
            interaction: {}
          });
        }
      }

      if (part2) {
        const passage_2 = `Citizen science\n\nCitizen science — research carried out with the help of volunteers — has grown rapidly over the past two decades. {{blank:1}}, the practice is far from new: amateur naturalists were recording bird migrations and rainfall long before the term was coined. What has changed is scale. {{blank:2}} smartphones and online platforms, a single project can now gather millions of observations in one season.\n\nThe appeal to researchers is obvious. They obtain data at a volume no funded team could collect alone, and across areas far wider than a research station can cover. {{blank:3}}, the benefits run in both directions: participants consistently report a better grasp of how evidence is gathered and why it is uncertain.\n\n{{blank:4}}, the approach has its critics, and their central objection is data quality. Volunteers differ widely in training, and an enthusiastic observer may record a rare species that was never there. {{blank:5}}, most large projects now build in verification: photographs are required, records are cross-checked against known ranges, and statistical models weight observations by an observer's track record.\n\n{{blank:6}}, citizen science is best understood not as a cheap substitute for professional research, but as a distinct method with strengths a laboratory cannot reproduce.`;
        const options_2 = [
          {"key": "A", "text": "In fact"}, {"key": "B", "text": "Thanks to"}, {"key": "C", "text": "Crucially"}, {"key": "D", "text": "However"},
          {"key": "E", "text": "In response"}, {"key": "F", "text": "Ultimately"}, {"key": "G", "text": "For instance"}, {"key": "H", "text": "In particular"}
        ];
        const correct_keys = ["A", "B", "C", "D", "E", "F"];
        for (let i = 0; i < 6; i++) {
          await apiClient.post(`/instructor/modules/${module.id}/parts/${part2.id}/questions`, {
            question_type: "matching_unique",
            prompt: `Reading 2 item ${i + 1}`,
            instructions: "Match the gap to the option.",
            passage: passage_2,
            options: options_2,
            correct_answers: [correct_keys[i]],
            points: 1.0,
            difficulty: "medium",
            source_type: "manual",
            interaction: {}
          });
        }
      }

      if (part3) {
        const passage_3 = `A — Library: extended opening\n\nFrom 12 May until the end of the examination period, the main library will open at 07:00 and close at 02:00 daily, including weekends. Group study rooms may be booked online up to seven days in advance; bookings not claimed within fifteen minutes will be released. Silent study is enforced on floors 4 and 5. Hot food may not be brought into the building.\n\nB — Academic Writing Centre\n\nThe centre offers free one-to-one appointments of thirty minutes with a writing tutor. Bring a printed draft and a copy of the assignment brief. Tutors will discuss structure, argument and referencing, and will help you identify recurring language errors — but they do not proofread, and they will not predict a grade. Appointments open each Monday at 09:00 and are usually taken within the day.\n\nC — Careers Fair\n\nOver ninety employers will attend this year's fair in the Sports Hall on 3 June, 10:00–16:00. No registration is needed. Students are advised to bring printed copies of their CV; a free CV review desk will operate near the entrance until 14:00. Employers in engineering, health and financial services are represented most heavily this year.\n\nD — Accommodation Office\n\nApplications for university housing for the next academic year close on 30 June. Late applications are considered only if rooms remain. Students wishing to remain in their current room must apply again; rooms are not renewed automatically. The office can also advise on private rented housing and will check a tenancy agreement before you sign it.`;
        const options_3 = [
          {"key": "A", "text": "Library: extended opening"},
          {"key": "B", "text": "Academic Writing Centre"},
          {"key": "C", "text": "Careers Fair"},
          {"key": "D", "text": "Accommodation Office"}
        ];
        const q3 = [
          { p: "Which text explains where you can get feedback on a draft before submitting it?", c: "B" },
          { p: "Which text warns that a service will not be continued automatically?", c: "D" },
          { p: "Which text states a time limit after which a reservation is cancelled?", c: "A" },
          { p: "Which text says that attendance requires no advance booking?", c: "C" },
          { p: "Which text tells you a document will be checked on your behalf before you commit to it?", c: "D" },
          { p: "Which text sets out a restriction on what you may bring into the building?", c: "A" },
          { p: "Which text advises bringing multiple copies of a document with you?", c: "C" }
        ];
        for (const q of q3) {
          await apiClient.post(`/instructor/modules/${module.id}/parts/${part3.id}/questions`, {
            question_type: "matching_reusable",
            prompt: q.p,
            instructions: "Match the text to the statement.",
            passage: passage_3,
            options: options_3,
            correct_answers: [q.c],
            points: 1.0,
            difficulty: "medium",
            source_type: "manual",
            interaction: {}
          });
        }
      }

      if (part4) {
        const passage_4 = `The rebound effect\n\nWhen a technology becomes more efficient, the intuitive expectation is that it will consume less. A refrigerator that uses half the electricity of its predecessor should, on that reasoning, halve the household's cooling bill. Economists have known for over a century that this expectation is frequently disappointed, and the reason has a name: the rebound effect.\n\nThe mechanism is not mysterious. Efficiency lowers the cost of using a service, and when something becomes cheaper, people tend to use more of it. A driver who replaces an old car with one that travels twice as far on a litre of fuel has, in effect, halved the price of a kilometre — and may respond by driving further, or by moving further from work. The saving is not eliminated, but part of it is spent rather than banked. Economists call this the direct rebound.\n\nThe indirect rebound is harder to see and harder to measure. Money not spent on fuel does not vanish; it is spent on something else, and that something else has an energy cost of its own. A household that saves two hundred pounds a year on heating and spends it on a short flight may end the year having increased its emissions. At the level of a whole economy the effect compounds further: cheaper energy services make energy-intensive production more attractive, which is one reason the enormous efficiency gains of the industrial era were accompanied by rising, not falling, total consumption.\n\nThe size of the effect is disputed, and the dispute matters. Most estimates for household energy in wealthy countries put direct rebound somewhere between ten and thirty per cent — meaning the majority of the intended saving is still realised. A minority of researchers argue that once economy-wide effects are included, rebound can approach or even exceed one hundred per cent, a proposition known as backfire. Backfire remains contested, and the evidence for it at national scale is thin.\n\nWhat follows for policy is less that efficiency fails than that it rarely works alone. Where efficiency lowers the cost of a service, a carbon price or a tax can hold that cost steady, allowing the technical gain to be kept rather than spent. Efficiency standards paired with pricing consistently outperform either instrument used by itself. The lesson is not that we should stop making things more efficient. It is that efficiency changes what a service costs, and people notice prices.`;
        const q4 = [
          { p: "According to the passage, the rebound effect occurs mainly because efficiency —", o: ["makes a service cheaper to use", "requires expensive new equipment", "is usually overstated by manufacturers", "reduces the quality of the service"], c: "A" },
          { p: "The example of the driver is used to illustrate —", o: ["indirect rebound", "direct rebound", "backfire", "the failure of efficiency standards"], c: "B" },
          { p: "What does the passage say about the household that saves on heating?", o: ["It will always reduce its total emissions", "It typically saves the money rather than spending it", "Its overall emissions may rise despite the saving", "Its saving is cancelled out by higher heating costs later"], c: "C" },
          { p: "How does the writer treat the idea of backfire?", o: ["As the established consensus among economists", "As a minority position that is not well supported", "As proof that efficiency policy should be abandoned", "As a phenomenon confined to household energy use"], c: "B" },
          { p: "It can be inferred from the final paragraph that the writer would most likely support —", o: ["replacing efficiency standards with carbon pricing", "combining efficiency standards with carbon pricing", "removing taxes on energy-efficient products", "delaying efficiency standards until rebound is fully understood"], c: "B" },
          { p: "The writer's main purpose in the passage is to —", o: ["warn that efficiency measures are ineffective and should be replaced", "explain a well-documented effect and what it implies for policy", "compare energy consumption in wealthy and developing economies", "argue that economists have misunderstood household behaviour"], c: "B" }
        ];
        for (const q of q4) {
          await apiClient.post(`/instructor/modules/${module.id}/parts/${part4.id}/questions`, {
            question_type: "mcq_single",
            prompt: q.p,
            instructions: "Choose the best option.",
            passage: passage_4,
            options: q.o.map((text, idx) => ({ key: String.fromCharCode(65 + idx), text })),
            correct_answers: [q.c],
            points: 1.0,
            difficulty: "medium",
            source_type: "manual",
            interaction: {}
          });
        }
      }

      await loadModule(module.parts?.[0]?.id);
      showSuccess("Reading Practice Test 1 successfully populated via UI Action!");
    } catch (err: unknown) {
      showError("Failed to populate test data.");
    } finally {
      setBusy(false);
    }
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
      {/* Sleek Breadcrumb Navigation Bar */}
      <div className="module-editor-breadcrumb-bar">
        <div className="module-editor-breadcrumb-left">
          <Link to={moduleWorkspacePath} className="button secondary module-back-btn">
            <Icon name="arrowLeft" />
            All Modules
          </Link>
          <div className="breadcrumb-trail">
            <span className="breadcrumb-separator">/</span>
            <span 
              className={`section-chip section-${module.module_type}`}
              onClick={() => setSelectedPartId(null)}
              style={{ cursor: "pointer" }}
              title="Edit Module Details"
            >
              {module.module_label}
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current-title">{module.title}</span>
          </div>
        </div>

        <div className="module-editor-breadcrumb-right">
          {module.module_type === "reading" && (
            <button
              type="button"
              className="ui-btn ui-btn-primary ui-btn-sm"
              id="vh-reading-auto-fill-btn"
              onClick={runReadingAutoFill}
              disabled={busy}
            >
              <span>🧙 Auto-Fill Questions</span>
            </button>
          )}
        </div>
      </div>

      {/* Sleek Bottom Floating Status Bar */}
      <div className="vh-bottom-floating-status-bar">
        <ModuleReadinessPanel module={module} busy={busy} onChangeStatus={changeStatus} onChoosePart={choosePart} />
        <Badge tone={module.status === "published" ? "green" : module.status === "archived" ? "gray" : "amber"}>
          {module.status}
        </Badge>
      </div>

      <div className="module-authoring-layout">
        <ModulePartNav parts={module.parts} selectedPartId={selectedPartId} onChoosePart={choosePart} />
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
              <PartSpecPanel
                part={selectedPart}
                isEditable={isEditable}
                busy={busy}
                onToggleAiEvaluation={togglePartAiEvaluation}
                onUpdateInstructions={updatePartInstructions}
                questionEntryMode={questionEntryMode}
                onEntryModeChange={setQuestionEntryMode}
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

            {selectedPart.section_type === "speaking" && (
              <>
                <SpeakingTimingPanel
                  part={selectedPart}
                  isEditable={isEditable}
                  busy={busy}
                  onSave={saveSpeakingTiming}
                />
              </>
            )}

            {isEditable && manual && (
              <div className="vh-entry-mode-wrapper">
                <div className="module-entry-tabbed-content">
                  {questionEntryMode === "manual" ? (
                    <ManualQuestionForm
                      part={selectedPart}
                      manual={manual}
                      editingQuestionId={editingQuestionId}
                      busy={busy}
                      uploadingImage={uploadingImage}
                      onAddOption={addOption}
                      onRemoveOption={removeOption}
                      onUpdateOption={updateOption}
                      onToggleCorrect={toggleCorrect}
                      onManualChange={setManual}
                      onUploadImage={uploadQuestionImage}
                      onRemoveImage={removeQuestionImage}
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

              <SavedQuestionsList part={selectedPart} isEditable={isEditable} onEdit={editQuestion} onDelete={deleteQuestion} />
            </>
          )}
        </main>
      </div>

      {editingQuestionId && selectedPart && manual && (
        <div className="modal-backdrop" onClick={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "95vh", overflowY: "auto", padding: 0, border: "none", background: "transparent", boxShadow: "none" }}>
            <ManualQuestionForm
              part={selectedPart}
              manual={manual}
              editingQuestionId={editingQuestionId}
              busy={busy}
              uploadingImage={uploadingImage}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onUpdateOption={updateOption}
              onToggleCorrect={toggleCorrect}
              onManualChange={setManual}
              onUploadImage={uploadQuestionImage}
              onRemoveImage={removeQuestionImage}
              onSubmit={saveQuestion}
              onCancelEdit={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
