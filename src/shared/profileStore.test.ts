import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectTargets } from "../content/adapters";
import { planFills, type MainWorldBridge } from "../content/plan";
import type { StoredFile } from "./files";
import type { Profile } from "./profile";
import { profileStore } from "./profileStore";
import type { ProfilesState } from "./profiles";

let store: Record<string, unknown>;

const cv = (name: string): StoredFile => ({ name, type: "application/pdf", size: 3, dataBase64: "JVBE", savedAt: "" });

beforeEach(() => {
  store = {};
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: structuredClone(store[key]) } : {}),
        set: async (items: Record<string, unknown>) => Object.assign(store, structuredClone(items)),
        remove: async (key: string) => {
          delete store[key];
        },
        getBytesInUse: async (key: string) => (key in store ? JSON.stringify(store[key]).length : 0),
      },
    },
  });
});

describe("saved answers", () => {
  it("adds new questions and replaces an answer when the same question is saved again", async () => {
    await profileStore.upsertAnswer("Czy znasz Dockera?", "nie");
    await profileStore.upsertAnswer("Uwagi", "Dostępny od grudnia");
    await profileStore.upsertAnswer("CZY ZNASZ DOCKERA?", "tak");
    const answers = await profileStore.getAnswers();
    expect(answers.map((a) => [a.question, a.answer])).toEqual([
      ["CZY ZNASZ DOCKERA?", "tak"],
      ["Uwagi", "Dostępny od grudnia"],
    ]);
  });
});

const BEFORE_PROFILES: Profile = {
  version: 1,
  values: {
    firstName: "Daniel",
    lastName: "Kowalski",
    email: "daniel@example.com",
    phone: "+48 600 000 000",
    tickRequiredConsent: "yes",
    city: "Warszawa",
    country: "Polska",
    workMode: ["remote"],
    linkedin: "https://www.linkedin.com/in/daniel",
  },
  languages: [{ language: "en", level: "C1" }],
  salaries: [{ amount: "15000", contract: "b2b", period: "month", basis: "net" }],
};

describe("moving to candidate profiles", () => {
  it("puts everything but name, email, phone and settings into a Default profile, CV included", async () => {
    store.profile = BEFORE_PROFILES;
    store.cv = cv("old.pdf");

    const state = await profileStore.getProfiles();

    expect(state.activeId).toBe("default");
    expect(state.list).toEqual([
      {
        id: "default",
        name: "Default",
        values: { city: "Warszawa", country: "Polska", workMode: ["remote"], linkedin: "https://www.linkedin.com/in/daniel" },
        languages: BEFORE_PROFILES.languages,
        salaries: BEFORE_PROFILES.salaries,
      },
    ]);
    expect(store["cv:default"]).toEqual(cv("old.pdf"));
    expect(store.cv).toBeUndefined();
    expect(await profileStore.getActive()).toEqual(BEFORE_PROFILES);
    expect(await profileStore.getCv()).toEqual(cv("old.pdf"));
  });

  it("migrates once: a second read, or a second context migrating the same data, changes nothing", async () => {
    store.profile = BEFORE_PROFILES;
    store.cv = cv("old.pdf");
    const first = await profileStore.getProfiles();
    const again = await profileStore.getProfiles();
    expect(again).toEqual(first);

    // Another context that read the old data before the first migration wrote the same result.
    delete store.profiles;
    expect(await profileStore.getProfiles()).toEqual(first);
    expect(store["cv:default"]).toEqual(cv("old.pdf"));
  });

  it("starts a new user with one empty Default profile", async () => {
    const state = await profileStore.getProfiles();
    expect(state).toEqual({ activeId: "default", list: [{ id: "default", name: "Default", values: {} }] });
    expect(await profileStore.getCv()).toBeNull();
    expect(await profileStore.hasCv()).toBe(false);
  });

  it("keeps only shared values in the shared record once it is saved", async () => {
    await profileStore.saveGlobal(BEFORE_PROFILES);
    expect((store.profile as Profile).values).toEqual({
      firstName: "Daniel",
      lastName: "Kowalski",
      email: "daniel@example.com",
      phone: "+48 600 000 000",
      tickRequiredConsent: "yes",
    });
  });
});

describe("the active profile", () => {
  beforeEach(async () => {
    store.profile = BEFORE_PROFILES;
    store.cv = cv("backend.pdf");
    await profileStore.getProfiles();
  });

  it("combines the shared name, email and phone with the active profile's own values", async () => {
    const pl = await profileStore.createProfile("Frontend – PL");
    await profileStore.saveProfile({ ...pl, values: { city: "Kraków", firstName: "Stale copy" } });
    await profileStore.setActive(pl.id);

    const active = await profileStore.getActive();
    expect(active.values).toEqual({
      firstName: "Daniel",
      lastName: "Kowalski",
      email: "daniel@example.com",
      phone: "+48 600 000 000",
      tickRequiredConsent: "yes",
      city: "Kraków",
    });
    expect(active.languages).toBeUndefined();
  });

  it("gives a fill the city and the CV of the profile that is switched to", async () => {
    const bridge: MainWorldBridge = {
      readSelectize: vi.fn(async () => ({})),
      setSelectize: vi.fn(async () => 0),
      searchSelectize: vi.fn(async () => null),
    };
    const pl = await profileStore.createProfile("Frontend – PL");
    await profileStore.saveProfile({ ...pl, values: { city: "Kraków" } });
    await profileStore.saveCv(cv("frontend.pdf"), pl.id);

    async function planned() {
      document.body.innerHTML = `
        <label for="city">City</label><input id="city">
        <label for="cv">CV</label><input id="cv" type="file">`;
      const actions = await planFills(collectTargets(document, false), await profileStore.getActive(), bridge, {
        loadCv: () => profileStore.getCv(),
      });
      return actions.map((a) => (a.kind === "text" ? a.value : a.kind === "file" ? a.file.name : a.kind));
    }

    expect(await planned()).toEqual(["Warszawa", "backend.pdf"]);
    await profileStore.setActive(pl.id);
    expect(await planned()).toEqual(["Kraków", "frontend.pdf"]);
  });

  it("copies a profile with its values and CV, and deletes one together with its CV", async () => {
    const copy = await profileStore.createProfile("Backend copy", "default");
    expect((await profileStore.getProfiles()).list[1]).toMatchObject({ name: "Backend copy", values: { city: "Warszawa" } });
    expect(await profileStore.getCv(copy.id)).toEqual(cv("backend.pdf"));

    await profileStore.setActive(copy.id);
    const next: ProfilesState = await profileStore.deleteProfile(copy.id);
    expect(next.activeId).toBe("default");
    expect(store[`cv:${copy.id}`]).toBeUndefined();
    expect(store["cv:default"]).toEqual(cv("backend.pdf"));
  });

  it("refuses to delete the last profile and leaves it as it was", async () => {
    await expect(profileStore.deleteProfile("default")).rejects.toThrow(/last profile/);
    expect((await profileStore.getProfiles()).list).toHaveLength(1);
    expect(store["cv:default"]).toEqual(cv("backend.pdf"));
  });

  it("ignores a switch to a profile that does not exist", async () => {
    await profileStore.setActive("gone");
    expect((await profileStore.getProfiles()).activeId).toBe("default");
  });
});
