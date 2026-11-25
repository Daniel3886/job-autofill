import { emptyProfile, type Profile } from "./profile";
import type { SavedAnswer } from "./answers";
import type { StoredFile } from "./files";
import {
  DEFAULT_PROFILE_NAME,
  activeProfile,
  effectiveProfile,
  isGlobalKey,
  mergeProfile,
  newProfileId,
  splitProfile,
  withoutProfile,
  type CandidateProfile,
  type ProfilesState,
} from "./profiles";
import { normalizeQuestion } from "./text";

/** The shared part: name, contact details, links, country, languages and behaviour settings. */
const PROFILE_KEY = "profile";
/** Candidate profiles and which one fills. */
const PROFILES_KEY = "profiles";
/** One CV per profile. */
const cvKey = (profileId: string) => `cv:${profileId}`;
/** Where the single CV lived before profiles. Moved to the default profile on first read. */
const LEGACY_CV_KEY = "cv";
const ANSWERS_KEY = "answers";
/**
 * Fixed, so two contexts migrating at the same moment write the same thing. The migration also
 * leaves the old values in `profile` (they are ignored) for the same reason.
 */
const DEFAULT_PROFILE_ID = "default";

async function readGlobal(): Promise<Profile> {
  const stored = await chrome.storage.local.get(PROFILE_KEY);
  return (stored[PROFILE_KEY] as Profile | undefined) ?? emptyProfile();
}

/** Builds the profile list from the single profile and CV stored before profiles existed. */
async function migrate(): Promise<ProfilesState> {
  const [whole, legacy] = await Promise.all([readGlobal(), chrome.storage.local.get(LEGACY_CV_KEY)]);
  const { own } = splitProfile(whole);
  const state: ProfilesState = {
    activeId: DEFAULT_PROFILE_ID,
    list: [{ id: DEFAULT_PROFILE_ID, name: DEFAULT_PROFILE_NAME, ...own }],
  };
  const cv = legacy[LEGACY_CV_KEY] as StoredFile | undefined;
  await chrome.storage.local.set({ [PROFILES_KEY]: state, ...(cv ? { [cvKey(DEFAULT_PROFILE_ID)]: cv } : {}) });
  if (cv) await chrome.storage.local.remove(LEGACY_CV_KEY);
  return state;
}

async function readProfiles(): Promise<ProfilesState> {
  const stored = await chrome.storage.local.get(PROFILES_KEY);
  const state = stored[PROFILES_KEY] as ProfilesState | undefined;
  return state && state.list.length > 0 ? state : migrate();
}

async function resolveId(profileId?: string): Promise<string> {
  if (profileId) return profileId;
  return activeProfile(await readProfiles())?.id ?? DEFAULT_PROFILE_ID;
}

export const profileStore = {
  /** The shared part only. Use getActive() for what a fill needs. */
  async getGlobal(): Promise<Profile> {
    const whole = await readGlobal();
    const shared: Profile = {
      version: 1,
      values: Object.fromEntries(Object.entries(whole.values).filter(([k]) => isGlobalKey(k))),
    };
    if (whole.languages) shared.languages = whole.languages;
    return shared;
  },

  /** Saves the shared part; any other value in `profile` is dropped, since it belongs to a candidate profile. */
  async saveGlobal(profile: Profile): Promise<void> {
    await chrome.storage.local.set({ [PROFILE_KEY]: splitProfile(profile).global });
  },

  async getProfiles(): Promise<ProfilesState> {
    return readProfiles();
  },

  async saveProfiles(state: ProfilesState): Promise<void> {
    await chrome.storage.local.set({ [PROFILES_KEY]: state });
  },

  /** The shared values plus the active candidate profile, in the shape the fill code reads. */
  async getActive(): Promise<Profile> {
    const [global, state] = await Promise.all([readGlobal(), readProfiles()]);
    return effectiveProfile(mergeProfile(global, activeProfile(state)));
  },

  async saveProfile(profile: CandidateProfile): Promise<void> {
    const state = await readProfiles();
    await profileStore.saveProfiles({
      ...state,
      list: state.list.map((p) => (p.id === profile.id ? profile : p)),
    });
  },

  /** A new profile, empty or a copy of `copyFrom` (its values and its CV). */
  async createProfile(name: string, copyFrom?: string): Promise<CandidateProfile> {
    const state = await readProfiles();
    const source = state.list.find((p) => p.id === copyFrom);
    const profile: CandidateProfile = source
      ? { ...structuredClone(source), id: newProfileId(), name }
      : { id: newProfileId(), name, values: {} };
    await profileStore.saveProfiles({ ...state, list: [...state.list, profile] });
    if (source) {
      const cv = await profileStore.getCv(source.id);
      if (cv) await profileStore.saveCv(cv, profile.id);
    }
    return profile;
  },

  async renameProfile(id: string, name: string): Promise<void> {
    const state = await readProfiles();
    await profileStore.saveProfiles({ ...state, list: state.list.map((p) => (p.id === id ? { ...p, name } : p)) });
  },

  /** Throws for the last profile. Deleting the active one makes another active. */
  async deleteProfile(id: string): Promise<ProfilesState> {
    const next = withoutProfile(await readProfiles(), id);
    await profileStore.saveProfiles(next);
    await chrome.storage.local.remove(cvKey(id));
    return next;
  },

  async setActive(id: string): Promise<void> {
    const state = await readProfiles();
    if (state.list.some((p) => p.id === id)) await profileStore.saveProfiles({ ...state, activeId: id });
  },

  /** The CV of `profileId`, or of the active profile. */
  async getCv(profileId?: string): Promise<StoredFile | null> {
    const key = cvKey(await resolveId(profileId));
    const stored = await chrome.storage.local.get(key);
    return (stored[key] as StoredFile | undefined) ?? null;
  },

  async hasCv(profileId?: string): Promise<boolean> {
    return (await chrome.storage.local.getBytesInUse(cvKey(await resolveId(profileId)))) > 0;
  },

  async saveCv(file: StoredFile, profileId?: string): Promise<void> {
    await chrome.storage.local.set({ [cvKey(await resolveId(profileId))]: file });
  },

  async removeCv(profileId?: string): Promise<void> {
    await chrome.storage.local.remove(cvKey(await resolveId(profileId)));
  },

  async getAnswers(): Promise<SavedAnswer[]> {
    const stored = await chrome.storage.local.get(ANSWERS_KEY);
    return (stored[ANSWERS_KEY] as SavedAnswer[] | undefined) ?? [];
  },

  async saveAnswers(answers: SavedAnswer[]): Promise<void> {
    await chrome.storage.local.set({ [ANSWERS_KEY]: answers });
  },

  async upsertAnswer(question: string, answer: string): Promise<void> {
    const answers = await profileStore.getAnswers();
    const key = normalizeQuestion(question);
    const entry: SavedAnswer = { question, answer, savedAt: new Date().toISOString() };
    const index = answers.findIndex((a) => normalizeQuestion(a.question) === key);
    if (index === -1) answers.push(entry);
    else answers[index] = entry;
    await profileStore.saveAnswers(answers);
  },
};
