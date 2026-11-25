import {
  CONSENT_SETTING,
  emptyProfile,
  type LanguageSkill,
  type Profile,
  type ProfileValue,
  type SalaryExpectation,
} from "./profile";

/**
 * Candidate profiles: one person, several ways to apply (a backend CV in English, a frontend CV
 * in Polish). Who the person is (name, contact, links, country, languages) and how the extension
 * behaves are shared; what depends on the application (CV, salary, preferences, city, region)
 * belongs to a profile. A profile may also override the shared country.
 */
export const GLOBAL_KEYS: readonly string[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "linkedin",
  "github",
  "website",
  "country",
  CONSENT_SETTING,
];

/** A profile's own country. Empty means the shared country applies. */
export const PROFILE_COUNTRY = "profileCountry";

export interface CandidateProfile {
  id: string;
  name: string;
  values: Record<string, ProfileValue>;
  languages?: LanguageSkill[];
  salaries?: SalaryExpectation[];
}

export interface ProfilesState {
  activeId: string;
  list: CandidateProfile[];
}

export const DEFAULT_PROFILE_NAME = "Default";

export const isGlobalKey = (key: string): boolean => GLOBAL_KEYS.includes(key);

export function newProfileId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const isEmpty = (value: ProfileValue | undefined): boolean =>
  value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim() === "");

/**
 * Splits the profile being edited into the shared part (with the languages) and the part one
 * candidate profile holds (with the salaries and its own country, if any).
 */
export function splitProfile(profile: Profile): { global: Profile; own: Omit<CandidateProfile, "id" | "name"> } {
  const globalValues: Record<string, ProfileValue> = {};
  const ownValues: Record<string, ProfileValue> = {};
  for (const [key, value] of Object.entries(profile.values)) {
    (isGlobalKey(key) ? globalValues : ownValues)[key] = value;
  }
  const global: Profile = { version: 1, values: globalValues };
  if (profile.languages) global.languages = profile.languages;
  const own: Omit<CandidateProfile, "id" | "name"> = { values: ownValues };
  if (profile.salaries) own.salaries = profile.salaries;
  return { global, own };
}

/**
 * The shared values and one candidate profile, as the options page edits them: the shared
 * country and the profile's own country stay apart. Values shared since an earlier version but
 * still stored in a profile (links, country, languages) are taken from it until the shared
 * record has them.
 */
export function mergeProfile(global: Profile, candidate: CandidateProfile | undefined): Profile {
  const own = candidate?.values ?? {};
  const values: Record<string, ProfileValue> = {};
  for (const [key, value] of Object.entries(own)) if (!isGlobalKey(key)) values[key] = value;
  for (const key of GLOBAL_KEYS) {
    const value = isEmpty(global.values[key]) ? own[key] : global.values[key];
    if (value !== undefined) values[key] = value;
  }
  // A country a profile held before countries were shared becomes that profile's own.
  const legacyCountry = own.country;
  if (isEmpty(values[PROFILE_COUNTRY]) && !isEmpty(legacyCountry) && legacyCountry !== values.country) {
    values[PROFILE_COUNTRY] = legacyCountry!;
  }
  const merged: Profile = { ...emptyProfile(), values };
  const languages = global.languages?.length ? global.languages : candidate?.languages;
  if (languages) merged.languages = languages;
  if (candidate?.salaries) merged.salaries = candidate.salaries;
  return merged;
}

/** What a fill uses: the profile's own country when it has one, otherwise the shared one. */
export function effectiveProfile(merged: Profile): Profile {
  const values = { ...merged.values };
  const own = values[PROFILE_COUNTRY];
  if (!isEmpty(own)) values.country = own;
  delete values[PROFILE_COUNTRY];
  return { ...merged, values };
}

export function activeProfile(state: ProfilesState): CandidateProfile | undefined {
  return state.list.find((p) => p.id === state.activeId) ?? state.list[0];
}

/** The profile after the active one, wrapping around: what the "next profile" shortcut picks. */
export function nextProfileId(state: ProfilesState): string {
  const index = state.list.findIndex((p) => p.id === state.activeId);
  return state.list[(index + 1) % state.list.length]?.id ?? state.activeId;
}

export interface ProfileMenuItem {
  id: string;
  title: string;
  checked: boolean;
}

export const PROFILE_MENU_PREFIX = "profile:";

/** Radio items for the icon's right-click menu, one per profile. */
export function profileMenuItems(state: ProfilesState): ProfileMenuItem[] {
  const active = activeProfile(state)?.id;
  return state.list.map((p) => ({ id: `${PROFILE_MENU_PREFIX}${p.id}`, title: p.name, checked: p.id === active }));
}

/**
 * The state without `id`. The last profile cannot go, and removing the active one makes the
 * profile before it (or the new first one) active.
 */
export function withoutProfile(state: ProfilesState, id: string): ProfilesState {
  if (state.list.length <= 1) throw new Error("The last profile cannot be deleted.");
  const index = state.list.findIndex((p) => p.id === id);
  if (index === -1) return state;
  const list = state.list.filter((p) => p.id !== id);
  const activeId = state.activeId === id ? list[Math.max(0, index - 1)].id : state.activeId;
  return { activeId, list };
}

/** The short badge shown when the profile changes: its first two letters. */
export const profileBadge = (name: string): string => name.trim().slice(0, 2);
