import { words } from "./locales";

export type TextFieldId =
  | "fullName"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "city"
  | "region"
  | "country"
  | "salary"
  | "linkedin"
  | "github"
  | "website";

export interface FieldRule {
  id: TextFieldId;
  autocomplete: string[];
  inputTypes: string[];
  keywords: string[];
  attrKeywords: string[];
  /** Labels that count only when they are the whole label ("Name", not "Company name"). */
  exactLabels?: string[];
  /** Fields this one rules out on the same input ("Imię i nazwisko" is not just the first name). */
  supersedes?: TextFieldId[];
}

function localeWords(id: TextFieldId): Pick<FieldRule, "keywords" | "attrKeywords" | "exactLabels"> {
  return {
    keywords: words((l) => l.fields?.[id]?.labels),
    attrKeywords: words((l) => l.fields?.[id]?.attributes),
    exactLabels: words((l) => l.fields?.[id]?.exact),
  };
}

export const SALARY_KEYWORDS = words((l) => l.fields?.salary?.labels);

export const FIELD_RULES: FieldRule[] = [
  { id: "fullName", autocomplete: ["name"], inputTypes: [], ...localeWords("fullName"), supersedes: ["firstName", "lastName"] },
  { id: "firstName", autocomplete: ["given-name"], inputTypes: [], ...localeWords("firstName") },
  { id: "lastName", autocomplete: ["family-name"], inputTypes: [], ...localeWords("lastName") },
  { id: "email", autocomplete: ["email"], inputTypes: ["email"], ...localeWords("email") },
  { id: "phone", autocomplete: ["tel", "tel-national", "tel-local"], inputTypes: ["tel"], ...localeWords("phone") },
  { id: "city", autocomplete: ["address-level2"], inputTypes: [], ...localeWords("city") },
  { id: "region", autocomplete: ["address-level1"], inputTypes: [], ...localeWords("region") },
  { id: "country", autocomplete: ["country-name"], inputTypes: [], ...localeWords("country") },
  { id: "salary", autocomplete: [], inputTypes: [], ...localeWords("salary") },
  { id: "linkedin", autocomplete: [], inputTypes: [], ...localeWords("linkedin") },
  { id: "github", autocomplete: [], inputTypes: [], ...localeWords("github") },
  { id: "website", autocomplete: [], inputTypes: [], ...localeWords("website") },
];
