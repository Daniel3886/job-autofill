import { words } from "./locales";

export type TextFieldId = "firstName" | "lastName" | "email" | "phone" | "city" | "salary";

export interface FieldRule {
  id: TextFieldId;
  autocomplete: string[];
  inputTypes: string[];
  keywords: string[];
  attrKeywords: string[];
}

function localeWords(id: TextFieldId): Pick<FieldRule, "keywords" | "attrKeywords"> {
  return {
    keywords: words((l) => l.fields?.[id]?.labels),
    attrKeywords: words((l) => l.fields?.[id]?.attributes),
  };
}

export const SALARY_KEYWORDS = words((l) => l.fields?.salary?.labels);

export const FIELD_RULES: FieldRule[] = [
  { id: "firstName", autocomplete: ["given-name"], inputTypes: [], ...localeWords("firstName") },
  { id: "lastName", autocomplete: ["family-name"], inputTypes: [], ...localeWords("lastName") },
  { id: "email", autocomplete: ["email"], inputTypes: ["email"], ...localeWords("email") },
  { id: "phone", autocomplete: ["tel", "tel-national", "tel-local"], inputTypes: ["tel"], ...localeWords("phone") },
  { id: "city", autocomplete: ["address-level2"], inputTypes: [], ...localeWords("city") },
  { id: "salary", autocomplete: [], inputTypes: [], ...localeWords("salary") },
];
