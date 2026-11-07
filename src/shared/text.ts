export function normalize(text: string): string {
  return text
    .replace(/([a-z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function containsPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  if (!normalizedText || !normalizedPhrase) return false;
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}
