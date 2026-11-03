import { emptyProfile, type Profile } from "./profile";

// The only module that touches storage. Adding passphrase encryption later
// means changing this file and nothing else.

const KEY = "profile";

export const profileStore = {
  async get(): Promise<Profile> {
    const stored = await chrome.storage.local.get(KEY);
    const profile = stored[KEY] as Profile | undefined;
    return profile ?? emptyProfile();
  },

  async save(profile: Profile): Promise<void> {
    await chrome.storage.local.set({ [KEY]: profile });
  },
};
