// The profile is a map from field id to value rather than a fixed object.
// Built-in fields are listed below; user-defined fields (the planned
// custom field picker) can be added later under new ids without a migration.

export const BUILT_IN_FIELDS = [
  { id: "firstName", label: "First name" },
  { id: "lastName", label: "Last name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "city", label: "City" },
  { id: "salary", label: "Salary expectation" },
] as const;

export type BuiltInFieldId = (typeof BUILT_IN_FIELDS)[number]["id"];

export interface Profile {
  version: 1;
  values: Record<string, string>;
}

export function emptyProfile(): Profile {
  return { version: 1, values: {} };
}

export function hasAnyValue(profile: Profile): boolean {
  return Object.values(profile.values).some((v) => v.trim() !== "");
}
