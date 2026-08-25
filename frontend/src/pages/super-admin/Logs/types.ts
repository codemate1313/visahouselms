export type LogType = "error" | "api" | "crash" | "request";

export interface LogRow {
  id: number;
  [key: string]: unknown;
}
