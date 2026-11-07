import { FIELD_RULES } from "../fieldRules";
import { words } from "../locales";
import { containsPhrase, normalize } from "../text";
import type { ChoiceOption } from "./optionMatch";

const PLACE_FIELDS = ["region", "country"] as const;

const PREFIXES = words((l) => l.placePrefixes);

export function classifyPlaceQuestion(question: string): string | null {
  const hits = PLACE_FIELDS.filter((id) =>
    FIELD_RULES.find((r) => r.id === id)?.keywords.some((k) => containsPhrase(question, k)),
  );
  return hits.length === 1 ? hits[0] : null;
}

export function isPlaceField(fieldId: string): boolean {
  return (PLACE_FIELDS as readonly string[]).includes(fieldId);
}

function placeName(text: string): string {
  let name = normalize(text);
  for (const prefix of PREFIXES) {
    if (name.startsWith(`${prefix} `)) name = name.slice(prefix.length + 1);
  }
  return name;
}

export function matchPlaceOption(saved: string, options: ChoiceOption[]): ChoiceOption | null {
  const name = placeName(saved);
  if (!name) return null;
  const hits = options.filter((o) => placeName(o.text) === name);
  return hits.length === 1 ? hits[0] : null;
}
