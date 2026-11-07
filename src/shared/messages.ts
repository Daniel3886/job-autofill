export interface FillResultMessage {
  type: "fill-result";
  filled: number;
}

export type MainWorldRequest =
  | { type: "main-world"; op: "readSelectize"; targets: string[] }
  | { type: "main-world"; op: "setSelectize"; items: SelectizeSetItem[] }
  | { type: "main-world"; op: "searchSelectize"; target: string; query: string };

export interface SelectizeSetItem {
  target: string;
  values: string[];
}

export interface SelectizeInfo {
  options: { value: string; text: string; details?: string[] }[];
  multiple: boolean;
  hasValue: boolean;
}

export const TARGET_ATTR = "data-job-autofill-target";

function hasType(msg: unknown, type: string): boolean {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === type;
}

export function isFillResult(msg: unknown): msg is FillResultMessage {
  return hasType(msg, "fill-result");
}

export function isMainWorldRequest(msg: unknown): msg is MainWorldRequest {
  return hasType(msg, "main-world");
}
