import { API_BASE_URL } from "@/api/client";
import type { AttemptQuestion, AttemptResponse } from "@/api/types";
import { Checkbox, RichTextEditor } from "@/components/ui";
import { renderBoldText } from "@/utils/boldText";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { CustomAudioPlayer } from "./CustomAudioPlayer";

interface QuestionInputProps {
  index: number;
  question: AttemptQuestion;
  hidePrompt?: boolean;
  allowBoldMarkup?: boolean;
  maxAnswerWords?: number;
  saving: boolean;
  recording: boolean;
  onChange: (response: AttemptResponse, debounce?: boolean) => void;
  onRecord: () => void;
  /** Final Test only: shows the exam toolbar's undo/redo pair. */
  languageCertSkin?: boolean;
}

export function QuestionInput({
  index,
  question,
  hidePrompt = false,
  allowBoldMarkup = false,
  maxAnswerWords,
  saving,
  recording,
  onChange,
  onRecord,
  languageCertSkin = false,
}: QuestionInputProps) {
  const selected = question.response?.selected;
  const t = strings.question;
  const textResponse = question.response?.text ?? "";
  const wordCount = textResponse.trim().split(/\s+/).filter(Boolean).length;
  const blankMarker = "{{blank}}";
  const hasInlineBlank = question.question_type === "fill_blank" && question.prompt.includes(blankMarker);
  const [beforeBlank, afterBlank = ""] = hasInlineBlank ? question.prompt.split(blankMarker, 2) : [question.prompt];
  const textInput = (
    <input
      type="text"
      className="test-runner-text-input"
      value={textResponse}
      aria-label={`Answer for question ${index}`}
      placeholder="Type answer here"
      onChange={(e) => onChange({ text: e.target.value }, true)}
      disabled={saving}
    />
  );

  return (
    <div className="test-runner-question">
      {!hidePrompt && (
        <div className="test-runner-question-head">
          {/* Both forms ship: the standard engine reads "Question 5", while the
              Final Test's exam skin shows the bare numeral in its own cell.
              Keeping the full label in the DOM means assistive tech still
              announces the word either way. */}
          <span className="test-runner-question-label">
            <span className="test-runner-question-label-full">{t.label(index)}</span>
            <span className="test-runner-question-label-number" aria-hidden="true">{index}</span>
          </span>
          <span className="hint" style={{ visibility: saving ? "visible" : "hidden", opacity: saving ? 1 : 0, transition: "opacity 0.2s ease" }}>
            {t.saving}
          </span>
        </div>
      )}
      {!hidePrompt && !hasInlineBlank && (
        <p className="test-runner-prompt">{allowBoldMarkup ? renderBoldText(question.prompt) : question.prompt}</p>
      )}
      {!hidePrompt && hasInlineBlank && (
        <p className="test-runner-prompt test-runner-inline-gap">
          <span>{allowBoldMarkup ? renderBoldText(beforeBlank) : beforeBlank}</span>
          {textInput}
          <span>{allowBoldMarkup ? renderBoldText(afterBlank) : afterBlank}</span>
        </p>
      )}
      {!hidePrompt && question.instructions && <p className="hint">{question.instructions}</p>}

      {(question.question_type === "mcq_single" ||
        question.question_type === "true_false_not_given" ||
        question.question_type === "yes_no_not_given" ||
        question.question_type === "matching_unique" ||
        question.question_type === "matching_reusable") && (
        <div className="test-runner-options">
          {question.options.map((option) => (
            <label key={option.key} className="test-runner-option">
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={selected === option.key}
                onChange={() => onChange({ selected: option.key })}
              />
              {option.text}
            </label>
          ))}
        </div>
      )}

      {question.question_type === "mcq_multiple" && (
        <div className="test-runner-options">
          {question.options.map((option) => {
            const list = Array.isArray(selected) ? selected : [];
            const checked = list.includes(option.key);
            return (
              <label key={option.key} className="test-runner-option">
                <Checkbox
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...list, option.key] : list.filter((k) => k !== option.key);
                    onChange({ selected: next });
                  }}
                />
                {option.text}
              </label>
            );
          })}
        </div>
      )}

      {(question.question_type === "short_answer" || question.question_type === "fill_blank") && (
        <>
          {!hasInlineBlank && textInput}
          {maxAnswerWords && (
            <p className={`hint${wordCount > maxAnswerWords ? " is-error" : ""}`}>
              {wordCount}/{maxAnswerWords} words
            </p>
          )}
        </>
      )}

      {question.question_type === "essay" && (
        <div className="test-runner-essay-wrapper">
          <RichTextEditor
            className="test-runner-essay"
            rows={16}
            showHistoryControls={languageCertSkin}
            placeholder="Write your response here..."
            value={textResponse}
            onChange={(nextText) => onChange({ text: nextText }, true)}
            toolbarExtras={
              <span className="hint" style={{ visibility: saving ? "visible" : "hidden", opacity: saving ? 1 : 0, transition: "opacity 0.2s ease", marginLeft: "auto", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t.saving}
              </span>
            }
          />
          <div className="test-runner-essay-footer">
            <p className="hint"><span className="test-runner-word-count">{wordCount}</span> {t.wordsSuffix}</p>
          </div>
        </div>
      )}

      {question.question_type === "speaking_prompt" && (
        <div className="test-runner-speaking">
          <button type="button" className={recording ? "danger" : ""} onClick={onRecord}>
            {recording ? t.stopRecording : question.audio_path ? t.reRecordAnswer : t.recordAnswer}
          </button>
          {question.audio_path && !recording && <CustomAudioPlayer src={`${API_BASE_URL}${question.audio_path}`} />}
        </div>
      )}
    </div>
  );
}
