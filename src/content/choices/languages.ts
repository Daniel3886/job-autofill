import { LANGUAGES, LANGUAGE_LEVELS } from "../../shared/profile";
import { words } from "../locales";
import { containsPhrase } from "../text";
import { cleanOptionText, type ChoiceOption } from "./optionMatch";
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

const SCALE_STEPS = words((l) => l.levelScale?.steps);
const SCALE_LOWEST = words((l) => l.levelScale?.lowest);
const SCALE_HIGHEST = words((l) => l.levelScale?.highest);
const PLACEHOLDER = /^(select|choose|wybierz|please|--)/;

/** Steps from the top of a scale that each CEFR level takes. A C1 or C2 speaker is not "native". */
const STEPS_FROM_TOP: Record<string, number> = { native: 0, C2: 1, C1: 1, B2: 2, B1: 3, A2: 4, A1: 5 };

const isOnly = (text: string, phrases: string[]) => phrases.includes(text);

/**
 * A level on a form's own proficiency scale ("Basic, Communicative, Good, Fluent, Native"), when the
 * options carry no CEFR codes. Used only when every option is a known proficiency step, there are at
 * least four of them, and one end of the list is clearly the bottom so the direction is known.
 */
export function pickOnLevelScale(level: string, options: ChoiceOption[]): ChoiceOption | null {
  const steps = options.filter((o) => !PLACEHOLDER.test(cleanOptionText(o.text)) && cleanOptionText(o.text) !== "");
  if (steps.length < 4 || !(level in STEPS_FROM_TOP)) return null;
  const texts = steps.map((o) => cleanOptionText(o.text));
  if (!texts.every((t) => isOnly(t, SCALE_STEPS))) return null;

  const first = texts[0];
  const last = texts[texts.length - 1];
  let ordered: ChoiceOption[];
  if (isOnly(first, SCALE_LOWEST) && isOnly(last, SCALE_HIGHEST)) ordered = steps;
  else if (isOnly(last, SCALE_LOWEST) && isOnly(first, SCALE_HIGHEST)) ordered = steps.toReversed();
  else return null;

  const index = ordered.length - 1 - STEPS_FROM_TOP[level];
  return index >= 0 ? ordered[index] : null;
}
