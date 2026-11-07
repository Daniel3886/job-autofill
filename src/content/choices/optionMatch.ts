import { containsPhrase, normalize } from "../text";
import type { ChoiceRule } from "./choiceRules";

export interface ChoiceOption {
  value: string;
  text: string;
}

export function cleanOptionText(text: string): string {
  return normalize(text.replace(/^\s*[a-z]\)\s*/i, ""));
}

export function matchCanonical(rule: ChoiceRule, canonical: string, options: ChoiceOption[]): ChoiceOption | null {
  const tiers = rule.options[canonical];
  if (!tiers) return null;
  for (const phrases of tiers) {
    const hits = options.filter((o) => {
      const text = cleanOptionText(o.text);
      return phrases.some((p) => containsPhrase(text, p));
    });
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null;
  }
  return null;
}

export function chooseChoiceOptions(
  rule: ChoiceRule,
  chosen: string[],
  options: ChoiceOption[],
  multiple: boolean,
): string[] | null {
  const matched = new Set<string>();
  for (const canonical of chosen) {
    const option = matchCanonical(rule, canonical, options);
    if (option) matched.add(option.value);
  }
  if (matched.size === 0) return null;
  if (!multiple && matched.size > 1) return null;
  return [...matched];
}
