import { FIELD_RULES, type FieldRule } from "./fieldRules";
import { readSignals, signalsQuestion, type InputSignals, type TextLike } from "./signals";
import { containsPhrase } from "./text";

// Points per signal. Stronger, more deliberate signals score higher.
export const WEIGHTS = {
  autocomplete: 100,
  inputType: 60,
  label: 50,
  ariaLabel: 50,
  attrs: 35,
  placeholder: 30,
  nearbyText: 30,
} as const;

// An input needs at least this score to be filled. One label match is enough;
// a lone weak hint is not.
export const MIN_SCORE = 30;

export interface Match {
  element: TextLike;
  fieldId: FieldRule["id"];
  score: number;
  question: string;
}

export function scoreField(s: InputSignals, rule: FieldRule): number {
  let score = 0;
  if (s.autocomplete.some((t) => rule.autocomplete.includes(t))) score += WEIGHTS.autocomplete;
  if (rule.inputTypes.includes(s.type)) score += WEIGHTS.inputType;

  const hit = (text: string) => rule.keywords.some((k) => containsPhrase(text, k));
  if (hit(s.label)) score += WEIGHTS.label;
  if (hit(s.ariaLabel)) score += WEIGHTS.ariaLabel;
  if (hit(s.placeholder)) score += WEIGHTS.placeholder;
  if (hit(s.nearbyText)) score += WEIGHTS.nearbyText;
  if (hit(s.attrs) || rule.attrKeywords.some((k) => containsPhrase(s.attrs, k))) {
    score += WEIGHTS.attrs;
  }
  return score;
}

// Scores every (input, field) pair, then assigns the best pairs first so each
// input gets at most one field and each field fills at most one input.
export function matchInputs(inputs: TextLike[], rules: FieldRule[] = FIELD_RULES): Match[] {
  const candidates: Match[] = [];
  for (const element of inputs) {
    const signals = readSignals(element);
    const question = signalsQuestion(signals);
    for (const rule of rules) {
      const score = scoreField(signals, rule);
      if (score >= MIN_SCORE) candidates.push({ element, fieldId: rule.id, score, question });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const usedInputs = new Set<TextLike>();
  const usedFields = new Set<string>();
  const matches: Match[] = [];
  for (const c of candidates) {
    if (usedInputs.has(c.element) || usedFields.has(c.fieldId)) continue;
    usedInputs.add(c.element);
    usedFields.add(c.fieldId);
    matches.push(c);
  }
  return matches;
}
