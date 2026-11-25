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
 * in Polish). Who the person is and how the extension behaves are shared; everything that
 * depends on the application (CV, salary, preferences, links, location) belongs to a profile.
 */
export const GLOBAL_KEYS: readonly string[] = ["firstName", "lastName", "email", "phone", CONSENT_SETTING];

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

/** Splits a whole profile into the shared part and the part one candidate profile holds. */
export function splitProfile(profile: Profile): { global: Profile; own: Omit<CandidateProfile, "id" | "name"> } {
  const globalValues: Record<string, ProfileValue> = {};
  const ownValues: Record<string, ProfileValue> = {};
  for (const [key, value] of Object.entries(profile.values)) {
    (isGlobalKey(key) ? globalValues : ownValues)[key] = value;
  }
  const own: Omit<CandidateProfile, "id" | "name"> = { values: ownValues };
  if (profile.languages) own.languages = profile.languages;
  if (profile.salaries) own.salaries = profile.salaries;
  return { global: { version: 1, values: globalValues }, own };
}

/** The profile a fill uses: shared values always come from `global`, the rest from `candidate`. */
export function mergeProfile(global: Profile, candidate: CandidateProfile | undefined): Profile {
  const values: Record<string, ProfileValue> = {};
  for (const [key, value] of Object.entries(candidate?.values ?? {})) if (!isGlobalKey(key)) values[key] = value;
  for (const [key, value] of Object.entries(global.values)) if (isGlobalKey(key)) values[key] = value;
  const merged: Profile = { ...emptyProfile(), values };
  if (candidate?.languages) merged.languages = candidate.languages;
  if (candidate?.salaries) merged.salaries = candidate.salaries;
  return merged;
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
