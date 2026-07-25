import { API_BASE_URL } from "@/api/client";
import type { AttemptQuestion, AttemptResponse } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface QuestionInputProps {
  index: number;
  question: AttemptQuestion;
  saving: boolean;
  recording: boolean;
  onChange: (response: AttemptResponse, debounce?: boolean) => void;
  onRecord: () => void;
}

export function QuestionInput({ index, question, saving, recording, onChange, onRecord }: QuestionInputProps) {
  const selected = question.response?.selected;
  const t = strings.question;

  return (
    <div className="test-runner-question">
      <div className="test-runner-question-head">
        <span>{t.label(index)}</span>
        {saving && <span className="hint">{t.saving}</span>}
      </div>
      <p className="test-runner-prompt">{question.prompt}</p>
      {question.instructions && <p className="hint">{question.instructions}</p>}

      {(question.question_type === "mcq_single" ||
        question.question_type === "true_false_not_given" ||
        question.question_type === "yes_no_not_given") && (
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
                <input
                  type="checkbox"
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
        <input
          type="text"
          className="test-runner-text-input"
          defaultValue={question.response?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value }, true)}
        />
      )}

      {question.question_type === "essay" && (
        <div>
          <textarea
            className="test-runner-essay"
            rows={10}
            defaultValue={question.response?.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value }, true)}
          />
          <p className="hint">{(question.response?.text ?? "").trim().split(/\s+/).filter(Boolean).length} {t.wordsSuffix}</p>
        </div>
      )}

      {question.question_type === "speaking_prompt" && (
        <div className="test-runner-speaking">
          <button type="button" className={recording ? "danger" : ""} onClick={onRecord}>
            {recording ? t.stopRecording : question.audio_path ? t.reRecordAnswer : t.recordAnswer}
          </button>
          {question.audio_path && !recording && <audio controls src={`${API_BASE_URL}${question.audio_path}`} />}
        </div>
      )}
    </div>
  );
}
