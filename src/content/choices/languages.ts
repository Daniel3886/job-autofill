import { LANGUAGES, LANGUAGE_LEVELS } from "../../shared/profile";
import { words } from "../locales";
import { containsPhrase } from "../text";
import type { ChoiceRule } from "./choiceRules";

const LANGUAGE_NAMES: Record<string, string[]> = Object.fromEntries(
  LANGUAGES.map(({ code }) => [code, words((l) => l.languages?.[code])]),
);

export function languageInQuestion(question: string): string | null {
  const hits = Object.entries(LANGUAGE_NAMES)
    .filter(([, names]) => names.some((n) => containsPhrase(question, n)))
    .map(([code]) => code);
  return hits.length === 1 ? hits[0] : null;
}

export const LANGUAGE_LEVEL_RULE: ChoiceRule = {
  fieldId: "languageLevel",
  questionKeywords: [],
  options: Object.fromEntries(
    LANGUAGE_LEVELS.map(({ value }) => {
      const localWords = words((l) => l.levels?.[value]);
      return [value, value === "native" ? [localWords, ["c2"]] : [[value.toLowerCase()], localWords]];
    }),
  ),
};
