// The profile is a map from field id to value rather than a fixed object.
// Text fields hold a string, multi-choice fields a list of option ids.
// User-defined fields (the planned custom field picker) can be added later
// under new ids without a migration.

export type ProfileValue = string | string[];

export interface Profile {
  version: 1;
  values: Record<string, ProfileValue>;
}

export const TEXT_FIELDS = [
  { id: "firstName", label: "First name", inputType: "text" },
  { id: "lastName", label: "Last name", inputType: "text" },
  { id: "email", label: "Email", inputType: "email" },
  { id: "phone", label: "Phone", inputType: "tel" },
  { id: "city", label: "City", inputType: "text" },
] as const;

// Salary depends on unit and contract type, so each has its own value.
// The extension never converts between them.
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

// Fixed answer lists. The content script maps each option id to the wording
// used on job sites (src/content/choices/choiceRules.ts).
export const CHOICE_FIELDS: ChoiceField[] = [
  {
    id: "englishLevel",
    label: "English level",
    multiple: false,
    options: ["A1", "A2", "B1", "B2", "C1", "C2"].map((v) => ({ value: v, label: v })),
  },
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
    label: "Preferred work mode",
    multiple: false,
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

export function hasAnyValue(profile: Profile): boolean {
  return Object.values(profile.values).some((v) =>
    Array.isArray(v) ? v.length > 0 : v.trim() !== "",
  );
}
