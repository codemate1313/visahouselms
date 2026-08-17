export interface SpeakingExaminer {
  id: string;
  name: string;
  title: string;
  gender: string;
  accent: string;
}

export const DEFAULT_EXAMINER_ID = "sonia";

export const SONIA_EXAMINER: SpeakingExaminer = {
  id: DEFAULT_EXAMINER_ID,
  name: "Instructor",
  title: "Senior Language CERT Speaking Examiner",
  gender: "female",
  accent: "British English",
};
