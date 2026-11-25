import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedAnswer } from "../shared/answers";
import type { Profile } from "../shared/profile";
import { mountLeverForm } from "../test/leverForm";
import { collectTargets } from "./adapters";
import { fillComboboxes } from "./comboboxes";
import { findLeftovers } from "./leftovers";
import { executeActions, planFills, type MainWorldBridge } from "./plan";
import { fillSearchBoxes } from "./searchBoxes";
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

/** The same steps the content script runs on a toolbar click. */
async function fillPage(profile: Profile, answers: SavedAnswer[] = []) {
  const targets = collectTargets(document, false, answers);
  const actions = await planFills(targets, profile, bridge);
  const executed = await executeActions(actions, bridge);
  const picked = await fillComboboxes(targets, profile);
  const searched = await fillSearchBoxes(targets, profile);
  return executed + picked + searched;
}

const answer = (question: string, value: string): SavedAnswer => ({ question, answer: value, savedAt: "" });
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
    expect(await fillPage(PROFILE, [answer("Current location", "India")])).toBe(3);
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
