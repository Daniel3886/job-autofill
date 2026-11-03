// Turns any label or attribute into space-separated lowercase ASCII words,
// so "Imię *", "firstName" and "first_name" can be compared with keywords.
export function normalize(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase -> camel Case
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: ę -> e, ó -> o
    .replace(/ł/g, "l") // ł has no decomposed form
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// True when a whole keyword phrase appears in the text on word boundaries,
// so "mail" matches "e mail" but not "mailing".
export function containsPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  if (!normalizedText || !normalizedPhrase) return false;
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}
