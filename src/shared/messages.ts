// Messages between the content script and the service worker.

export interface FillResultMessage {
  type: "fill-result";
  filled: number;
}

// The content script runs in an isolated world and cannot see page objects
// such as a Selectize instance. It asks the service worker to run a small
// function in the page's MAIN world instead. Only element tags and option
// ids cross that boundary, never profile data.
export type MainWorldRequest =
  | { type: "main-world"; op: "readSelectize"; targets: string[] }
  | { type: "main-world"; op: "setSelectize"; items: SelectizeSetItem[] };

export interface SelectizeSetItem {
  target: string;
  values: string[];
}

export interface SelectizeInfo {
  options: { value: string; text: string }[];
  multiple: boolean;
  hasValue: boolean;
}

// Attribute the content script puts on elements the MAIN world must find.
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
