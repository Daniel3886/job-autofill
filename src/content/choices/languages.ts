import { containsPhrase } from "../text";
import type { ChoiceRule } from "./choiceRules";

const LANGUAGE_NAMES: Record<string, string[]> = {
  en: ["english", "angielski", "angielskiego"],
  de: ["german", "niemiecki", "niemieckiego"],
  fr: ["french", "francuski", "francuskiego"],
  es: ["spanish", "hiszpanski", "hiszpanskiego"],
  it: ["italian", "wloski", "wloskiego"],
  pl: ["polish", "polski", "polskiego"],
  uk: ["ukrainian", "ukrainski", "ukrainskiego"],
  ru: ["russian", "rosyjski", "rosyjskiego"],
  nl: ["dutch", "niderlandzki", "niderlandzkiego", "holenderski", "holenderskiego"],
  pt: ["portuguese", "portugalski", "portugalskiego"],
  cs: ["czech", "czeski", "czeskiego"],
  sv: ["swedish", "szwedzki", "szwedzkiego"],
  no: ["norwegian", "norweski", "norweskiego"],
  ja: ["japanese", "japonski", "japonskiego"],
  zh: ["chinese", "chinski", "chinskiego"],
};

export function languageInQuestion(question: string): string | null {
  const hits = Object.entries(LANGUAGE_NAMES)
    .filter(([, names]) => names.some((n) => containsPhrase(question, n)))
    .map(([code]) => code);
  return hits.length === 1 ? hits[0] : null;
}

export const LANGUAGE_LEVEL_RULE: ChoiceRule = {
  fieldId: "languageLevel",
  questionKeywords: [],
  options: {
    A1: [["a1"], ["beginner", "poczatkujacy"]],
    A2: [["a2"], ["elementary", "podstawowy"]],
    B1: [["b1"], ["intermediate"]],
    B2: [["b2"], ["upper intermediate"]],
    C1: [["c1"], ["advanced", "zaawansowany"]],
    C2: [["c2"], ["proficient", "biegly"]],
    native: [["native", "ojczysty", "natywny"], ["c2"]],
  },
};
