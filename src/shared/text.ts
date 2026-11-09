export function normalize(text: string): string {
  return fold(text.replace(/([a-z])([A-Z][a-z])/g, "$1 $2"));
}

export function normalizeQuestion(text: string): string {
  return fold(text);
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function containsPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  if (!normalizedText || !normalizedPhrase) return false;
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}
