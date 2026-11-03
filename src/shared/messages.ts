// Messages sent from the content script back to the service worker.

export interface FillResultMessage {
  type: "fill-result";
  filled: number;
}

export function isFillResult(msg: unknown): msg is FillResultMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type?: unknown }).type === "fill-result"
  );
}
