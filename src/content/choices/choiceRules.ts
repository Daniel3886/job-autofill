import { SALARY_KEYWORDS } from "../fieldRules";
import { containsPhrase } from "../text";
import { languageInQuestion } from "./languages";

export interface ChoiceRule {
  fieldId: string;
  questionKeywords: string[];
  options: Record<string, string[][]>;
}

export const CHOICE_RULES: ChoiceRule[] = [
  {
    fieldId: "availability",
    questionKeywords: [
      "dostepnosc",
      "availability",
      "notice period",
      "okres wypowiedzenia",
      "od kiedy",
      "start date",
      "kiedy mozesz zaczac",
      "when can you start",
    ],
    options: {
      immediately: [["od zaraz", "natychmiast", "od razu", "immediately", "asap", "as soon as possible"]],
      "1w": [["1 tydzien", "1 week", "one week", "7 dni", "7 days"]],
      "2w": [["2 tygodnie", "2 weeks", "two weeks", "14 dni", "14 days"]],
      "1m": [["1 miesiac", "1 month", "one month"], ["30 dni", "30 days"]],
      "2m": [["2 miesiace", "2 months", "two months"], ["60 dni", "60 days"]],
      "3m": [["3 miesiace", "3 months", "three months"], ["90 dni", "90 days"]],
    },
  },
  {
    fieldId: "contractTypes",
    questionKeywords: [
      "forma wspolpracy",
      "formy wspolpracy",
      "rodzaj umowy",
      "typ umowy",
      "forma zatrudnienia",
      "contract type",
      "type of contract",
      "employment type",
    ],
    options: {
      uop: [["umowa o prace", "uop", "employment contract", "contract of employment"]],
      b2b: [["b2b"]],
      civil: [["umowa cywilnoprawna", "umowa zlecenie", "zlecenie", "umowa o dzielo", "dzielo"]],
    },
  },
  {
    fieldId: "workMode",
    questionKeywords: ["model pracy", "tryb pracy", "work mode", "work model", "working model"],
    options: {
      office: [["stacjonarny", "stacjonarna", "stacjonarnie", "office", "on site", "onsite"]],
      hybrid: [["hybrydowy", "hybrydowa", "hybrydowo", "hybrid"]],
      remote: [["zdalny", "zdalna", "zdalnie", "remote", "fully remote"]],
    },
  },
];

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
