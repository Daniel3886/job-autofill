import { emptyProfile, type Profile } from "./profile";
import type { StoredFile } from "./files";

// The only module that touches storage. Adding passphrase encryption later
// means changing this file and nothing else.
//
// The CV lives under its own key so that reading the profile (every icon
// click, every options page load) never pulls megabytes of file data.
// The manifest's unlimitedStorage permission lifts the 10 MB quota.

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

  // Checks for a CV without loading its bytes.
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
