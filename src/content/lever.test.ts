import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedAnswer } from "../shared/answers";
import type { Profile } from "../shared/profile";
import { mountLeverForm } from "../test/leverForm";
import type { StoredFile } from "../shared/files";
import { fillDocument } from "./fill";
import { findLeftovers } from "./leftovers";
import type { FileSource, MainWorldBridge } from "./plan";
import { rawQuestionText } from "./signals";
import { startPicker } from "../picker/picker";

const PLACES = ["India", "Indianapolis, Indiana, United States", "Warsaw, Masovian Voivodeship, Poland", "Warsaw, Indiana, United States"];

const PROFILE: Profile = {
  version: 1,
  values: { firstName: "Daniel", lastName: "Kowalski", email: "daniel@example.com", phone: "+48 600 000 000" },
};

const bridge: MainWorldBridge = {
  readSelectize: vi.fn(async () => ({})),
  setSelectize: vi.fn(async () => 0),
  searchSelectize: vi.fn(async () => null),
};

const CV: StoredFile = { name: "cv.pdf", type: "application/pdf", size: 3, dataBase64: "JVBE", savedAt: "" };
const NO_CV: FileSource = { loadCv: async () => null };
const WITH_CV: FileSource = { loadCv: async () => CV };

/** What one toolbar click does, without the panel. */
async function fillPage(profile: Profile, answers: SavedAnswer[] = [], files = NO_CV, onProgress?: (m: string) => void) {
  return fillDocument(document, { profile, answers, bridge, files, checkVisibility: false, onProgress });
}

const answer = (question: string, value: string): SavedAnswer => ({ question, answer: value, savedAt: "" });
/** Lets a parse still running finish, so assertions see what the page ends up with. */
const parserDone = () => new Promise((resolve) => setTimeout(resolve, 300));
const field = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;

afterEach(() => vi.restoreAllMocks());

describe("Lever: question text", () => {
  it("reads only the question for a field its label wraps, not the dropdown's hidden messages", () => {
    const { input } = mountLeverForm(PLACES);
    expect(rawQuestionText(input)).toBe("Current location");
    expect(rawQuestionText(field("phone"))).toBe("Phone");
  });

  it("lists the location in the 'Left for you' report by its question only", () => {
    mountLeverForm(PLACES);
    const location = findLeftovers(document, false).find((l) => l.question.startsWith("Current location"));
    expect(location).toEqual({ question: "Current location", required: true });
  });
});

describe("Lever: the location search box", () => {
  it("fills a saved answer by searching and choosing the matching result, so the page keeps it", async () => {
    const { input, selected, searches } = mountLeverForm(PLACES);
    await fillPage(PROFILE, [answer("Current location", "India")]);
    expect(input.value).toBe("India");
    expect(JSON.parse(selected.value)).toEqual({ name: "India" });
    expect(searches).toEqual(["India"]);
  });

  it("uses the profile's city over a saved answer, and the saved country to tell two Warsaws apart", async () => {
    const { input, selected } = mountLeverForm(PLACES);
    await fillPage({ ...PROFILE, values: { ...PROFILE.values, city: "Warszawa", country: "Polska" } }, [
      answer("Current location", "India"),
    ]);
    expect(input.value).toBe("Warsaw, Masovian Voivodeship, Poland");
    expect(JSON.parse(selected.value)).toEqual({ name: "Warsaw, Masovian Voivodeship, Poland" });
  });

  it("leaves the box when several results share the city's name and no country is saved", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { input, selected } = mountLeverForm(PLACES);
    await fillPage({ ...PROFILE, values: { ...PROFILE.values, city: "Warsaw" } });
    expect(input.value).toBe("");
    expect(selected.value).toBe("");
  });

  it("does not take a result that only starts like the answer", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { input, selected } = mountLeverForm(["Indianapolis, Indiana, United States"]);
    expect((await fillPage(PROFILE, [answer("Current location", "India")])).filled).toBe(3);
    expect(input.value).toBe("");
    expect(selected.value).toBe("");
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"Current location" not filled: no result matched "India"'));
  });

  it("fills the other Lever fields as before and leaves the location alone with nothing saved for it", async () => {
    const { input, searches } = mountLeverForm(PLACES);
    await fillPage(PROFILE);
    expect(field("name").value).toBe("Daniel Kowalski");
    expect(field("email").value).toBe("daniel@example.com");
    expect(field("phone").value).toBe("+48 600 000 000");
    expect(input.value).toBe("");
    expect(searches).toEqual([]);
  });

  it("leaves a location someone already chose", async () => {
    const { input, selected, searches } = mountLeverForm(PLACES);
    input.value = "Warsaw, Masovian Voivodeship, Poland";
    selected.value = '{"name":"Warsaw, Masovian Voivodeship, Poland"}';
    await fillPage(PROFILE, [answer("Current location", "India")]);
    expect(input.value).toBe("Warsaw, Masovian Voivodeship, Poland");
    expect(searches).toEqual([]);
  });

});
describe("Lever: the CV parser that runs after the upload", () => {
  it("fills the location after Lever has read the CV, so the parser does not clear it", async () => {
    const { input, selected } = mountLeverForm(PLACES, 20, { position: "OneTap.Work" });
    await fillPage(PROFILE, [answer("Current location", "India")], WITH_CV);
    await parserDone();
    expect(input.value).toBe("India");
    expect(JSON.parse(selected.value)).toEqual({ name: "India" });
  });

  it("says what it is waiting for while Lever reads the CV", async () => {
    mountLeverForm(PLACES, 20, {});
    const onProgress = vi.fn();
    await fillPage(PROFILE, [], WITH_CV, onProgress);
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("Waiting for Lever to read your CV"));
  });

  it("does not wait when no CV was attached", async () => {
    mountLeverForm(PLACES, 20, {});
    const onProgress = vi.fn();
    await fillPage(PROFILE, [answer("Current location", "India")], NO_CV, onProgress);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("keeps the profile's phone and a saved company over what the CV says", async () => {
    mountLeverForm(PLACES, 20, { position: "Company From CV", phone: "999999999" });
    await fillPage(PROFILE, [answer("Current company", "OneTap.Work")], WITH_CV);
    await parserDone();
    expect(field("phone").value).toBe("+48 600 000 000");
    expect(field("org").value).toBe("OneTap.Work");
  });

  it("does not report the company as left when the CV filled it", async () => {
    mountLeverForm(PLACES, 20, { position: "OneTap.Work" });
    const { leftovers } = await fillPage(PROFILE, [], WITH_CV);
    expect(field("org").value).toBe("OneTap.Work");
    expect(leftovers.map((l) => l.question)).not.toContain("Current company");
    expect(leftovers.map((l) => l.question)).toContain("Current location");
  });

  it("leaves a location the CV filled instead of typing over it", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { input, searches } = mountLeverForm(PLACES, 20, { location: { name: "Kraków, Poland" } });
    await fillPage({ ...PROFILE, values: { ...PROFILE.values, city: "Warsaw", country: "Poland" } }, [], WITH_CV);
    expect(input.value).toBe("Kraków, Poland");
    expect(searches).toEqual([]);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("the page filled it in the meantime"));
  });
});

describe("Lever: picking the location box with the field picker", () => {
  it("saves the answer under the clean question and fills the box so the page keeps it", async () => {
    const { input, selected } = mountLeverForm(PLACES);
    const saveAnswer = vi.fn(async () => {});
    const stop = startPicker(document, { saveAnswer });

    input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const root = document.getElementById("job-autofill-picker")!.shadowRoot!;
    const form = root.querySelector<HTMLFormElement>("form")!;
    expect(root.querySelector<HTMLTextAreaElement>('[name="question"]')!.value).toBe("Current location");
    root.querySelector<HTMLInputElement>('[name="answer"]')!.value = "India";
    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() => expect(selected.value).not.toBe(""), { timeout: 3000 });
    expect(saveAnswer).toHaveBeenCalledWith("Current location", "India");
    expect(input.value).toBe("India");
    stop();
  });
});
