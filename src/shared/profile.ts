export type ProfileValue = string | string[];

export interface LanguageSkill {
  language: string;
  level: string;
}

export interface Profile {
  version: 1;
  values: Record<string, ProfileValue>;
  languages?: LanguageSkill[];
}

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ru", label: "Russian" },
  { code: "nl", label: "Dutch" },
  { code: "pt", label: "Portuguese" },
  { code: "cs", label: "Czech" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
];

export const LANGUAGE_LEVELS = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
  { value: "native", label: "Native" },
];

export const TEXT_FIELDS = [
  { id: "firstName", label: "First name", inputType: "text" },
  { id: "lastName", label: "Last name", inputType: "text" },
  { id: "email", label: "Email", inputType: "email" },
  { id: "phone", label: "Phone", inputType: "tel" },
  { id: "city", label: "City", inputType: "text" },
] as const;

export const SALARY_FIELDS = [
  { id: "salaryMonthlyGrossUop", label: "Monthly, gross, employment contract (UoP)" },
  { id: "salaryMonthlyNetB2b", label: "Monthly, net, B2B" },
  { id: "salaryHourlyNetB2b", label: "Hourly, net, B2B" },
] as const;

export type SalaryFieldId = (typeof SALARY_FIELDS)[number]["id"];

export interface ChoiceField {
  id: string;
  label: string;
  multiple: boolean;
  options: { value: string; label: string }[];
}

export const CHOICE_FIELDS: ChoiceField[] = [
  {
    id: "availability",
    label: "Available to start",
    multiple: false,
    options: [
      { value: "immediately", label: "Immediately" },
      { value: "1w", label: "In 1 week" },
      { value: "2w", label: "In 2 weeks" },
      { value: "1m", label: "In 1 month" },
      { value: "2m", label: "In 2 months" },
      { value: "3m", label: "In 3 months" },
    ],
  },
  {
    id: "contractTypes",
    label: "Contract types you accept",
    multiple: true,
    options: [
      { value: "uop", label: "Employment contract (UoP)" },
      { value: "b2b", label: "B2B" },
      { value: "civil", label: "Civil law contract (zlecenie / dzieło)" },
    ],
  },
  {
    id: "workMode",
    label: "Work modes you accept",
    multiple: true,
    options: [
      { value: "office", label: "Office" },
      { value: "hybrid", label: "Hybrid" },
      { value: "remote", label: "Remote" },
    ],
  },
];

export function emptyProfile(): Profile {
  return { version: 1, values: {} };
}

export function getText(profile: Profile, id: string): string {
  const v = profile.values[id];
  return typeof v === "string" ? v.trim() : "";
}

export function getList(profile: Profile, id: string): string[] {
  const v = profile.values[id];
  if (Array.isArray(v)) return v;
  return typeof v === "string" && v !== "" ? [v] : [];
}

export function getLanguages(profile: Profile): LanguageSkill[] {
  if (profile.languages) return profile.languages;
  const legacyEnglish = getText(profile, "englishLevel");
  return legacyEnglish ? [{ language: "en", level: legacyEnglish }] : [];
}

export function hasAnyValue(profile: Profile): boolean {
  if (getLanguages(profile).length > 0) return true;
  return Object.values(profile.values).some((v) =>
    Array.isArray(v) ? v.length > 0 : v.trim() !== "",
  );
}
