// Files the user stores in the extension, such as the CV.
// chrome.storage.local stores JSON only, so file bytes are kept as base64.
// The extension cannot reopen a file from disk later, so the bytes themselves
// are copied in when the user picks the file.

export interface StoredFile {
  name: string;
  type: string;
  size: number; // bytes of the original file
  dataBase64: string;
  savedAt: string; // ISO date
}

// Job boards commonly cap uploads at 5-20 MB; anything bigger will not be accepted anyway.
export const MAX_CV_BYTES = 20 * 1024 * 1024;

export const CV_ACCEPT = ".pdf,.doc,.docx,.odt,.rtf";

export async function fileToStored(file: File): Promise<StoredFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    name: file.name,
    type: file.type || guessType(file.name),
    size: file.size,
    dataBase64: bytesToBase64(bytes),
    savedAt: new Date().toISOString(),
  };
}

export function storedToFile(stored: StoredFile): File {
  return new File([base64ToBytes(stored.dataBase64)], stored.name, { type: stored.type });
}

// String.fromCharCode in chunks: spreading a whole multi-MB array at once
// exceeds the engine's argument limit.
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
};

function guessType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}
