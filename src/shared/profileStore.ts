import { emptyProfile, type Profile } from "./profile";
import type { SavedAnswer } from "./answers";
import type { StoredFile } from "./files";
import { normalize } from "./text";

const PROFILE_KEY = "profile";
const CV_KEY = "cv";
const ANSWERS_KEY = "answers";

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

  async getAnswers(): Promise<SavedAnswer[]> {
    const stored = await chrome.storage.local.get(ANSWERS_KEY);
    return (stored[ANSWERS_KEY] as SavedAnswer[] | undefined) ?? [];
  },

  async saveAnswers(answers: SavedAnswer[]): Promise<void> {
    await chrome.storage.local.set({ [ANSWERS_KEY]: answers });
  },

  async upsertAnswer(question: string, answer: string): Promise<void> {
    const answers = await profileStore.getAnswers();
    const key = normalize(question);
    const entry: SavedAnswer = { question, answer, savedAt: new Date().toISOString() };
    const index = answers.findIndex((a) => normalize(a.question) === key);
    if (index === -1) answers.push(entry);
    else answers[index] = entry;
    await profileStore.saveAnswers(answers);
  },
};
