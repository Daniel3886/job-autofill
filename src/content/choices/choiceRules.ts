import { CHOICE_FIELDS } from "../../shared/profile";
import { SALARY_KEYWORDS } from "../fieldRules";
import { tiers, words } from "../locales";
import { containsPhrase } from "../text";
import { languageInQuestion } from "./languages";

export interface ChoiceRule {
  fieldId: string;
  questionKeywords: string[];
  options: Record<string, string[][]>;
}

export const CHOICE_RULES: ChoiceRule[] = CHOICE_FIELDS.map((field) => ({
  fieldId: field.id,
  questionKeywords: words((l) => l.questions?.[field.id]),
  options: Object.fromEntries(
    field.options.map((o) => [o.value, tiers((l) => l.options?.[field.id]?.[o.value])]),
  ),
}));

export const CHOICE_RULE_BY_ID = new Map(CHOICE_RULES.map((r) => [r.fieldId, r]));

export function classifyQuestion(question: string): string | null {
  const hits = CHOICE_RULES.filter((r) => r.questionKeywords.some((k) => containsPhrase(question, k))).map(
    (r) => r.fieldId,
  );
  if (SALARY_KEYWORDS.some((k) => containsPhrase(question, k))) hits.push("salary");
  const language = languageInQuestion(question);
  if (language) hits.push(`language:${language}`);
  return hits.length === 1 ? hits[0] : null;
}
