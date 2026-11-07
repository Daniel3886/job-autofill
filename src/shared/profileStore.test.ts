import { beforeEach, describe, expect, it, vi } from "vitest";
import { profileStore } from "./profileStore";

let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (items: Record<string, unknown>) => Object.assign(store, items),
      },
    },
  });
});

describe("saved answers", () => {
  it("adds new questions and replaces an answer when the same question is saved again", async () => {
    await profileStore.upsertAnswer("Czy znasz Dockera?", "nie");
    await profileStore.upsertAnswer("Uwagi", "Dostępny od grudnia");
    await profileStore.upsertAnswer("czy znasz DOCKERA", "tak");
    const answers = await profileStore.getAnswers();
    expect(answers.map((a) => [a.question, a.answer])).toEqual([
      ["czy znasz DOCKERA", "tak"],
      ["Uwagi", "Dostępny od grudnia"],
    ]);
  });
});
