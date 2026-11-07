import { emptyProfile, type Profile } from "./profile";
import type { StoredFile } from "./files";

const PROFILE_KEY = "profile";
const CV_KEY = "cv";

export const profileStore = {
  async get(): Promise<Profile> {
    const stored = await chrome.storage.local.get(PROFILE_KEY);
    const profile = stored[PROFILE_KEY] as Profile | undefined;
    return profile ?? emptyProfile();
  },

  async save(profile: Profile): Promise<void> {
    await chrome.storage.local.set({ [PROFILE_KEY]: profile });
  },

  async getCv(): Promise<StoredFile | null> {
    const stored = await chrome.storage.local.get(CV_KEY);
    return (stored[CV_KEY] as StoredFile | undefined) ?? null;
  },

  async hasCv(): Promise<boolean> {
    return (await chrome.storage.local.getBytesInUse(CV_KEY)) > 0;
  },

  async saveCv(file: StoredFile): Promise<void> {
    await chrome.storage.local.set({ [CV_KEY]: file });
  },

  async removeCv(): Promise<void> {
    await chrome.storage.local.remove(CV_KEY);
  },
};
