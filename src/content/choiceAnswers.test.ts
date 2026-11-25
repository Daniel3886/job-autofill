import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedAnswer } from "../shared/answers";
import type { Profile } from "../shared/profile";
import { HOST_ID, startPicker } from "../picker/picker";
import { fillDocument } from "./fill";
import type { MainWorldBridge } from "./plan";

const bridge: MainWorldBridge = {
  readSelectize: vi.fn(async () => ({})),
  setSelectize: vi.fn(async () => 0),
  searchSelectize: vi.fn(async () => null),
};

const EMPTY: Profile = { version: 1, values: {} };
const answer = (question: string, value: string): SavedAnswer => ({ question, answer: value, savedAt: "" });
const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

async function fill(answers: SavedAnswer[], profile = EMPTY) {
  return fillDocument(document, { profile, answers, bridge, files: { loadCv: async () => null }, checkVisibility: false });
}

/** A react-select-like combobox: opens a listbox on mousedown, takes an option on click. */
function combobox(id: string, label: string, options: string[], chosen = "") {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<label id="${id}-l" for="${id}">${label}</label>
    <div class="select__container">
      ${chosen ? `<div class="select__single-value">${chosen}</div>` : ""}
      <input id="${id}" role="combobox" aria-controls="${id}-list" aria-labelledby="${id}-l">
    </div>`;
  document.body.append(wrap);
  const input = wrap.querySelector<HTMLInputElement>("input")!;
  input.addEventListener("mousedown", () => {
    if (document.getElementById(`${id}-list`)) return;
    const list = document.createElement("div");
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    for (const text of options) {
      const row = document.createElement("div");
      row.setAttribute("role", "option");
      row.textContent = text;
      row.addEventListener("click", () => {
        wrap.querySelector(".select__single-value")?.remove();
        wrap.querySelector(".select__container")!.insertAdjacentHTML("afterbegin", `<div class="select__single-value">${text}</div>`);
        list.remove();
      });
      list.append(row);
    }
    wrap.append(list);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.getElementById(`${id}-list`)?.remove();
  });
  return { wrap, value: () => wrap.querySelector(".select__single-value")?.textContent ?? "" };
}

const FORM = `
  <label for="auth">Are you legally authorised to work in India?</label>
  <select id="auth"><option value="">Select…</option><option value="y">Yes</option><option value="n">No</option></select>
  <fieldset><legend>Will you require sponsorship?</legend>
    <label><input type="radio" name="visa" value="1"> Yes</label>
    <label><input type="radio" name="visa" value="0"> No</label>
  </fieldset>
  <label for="why">Why us?</label><input id="why">`;

afterEach(() => {
  document.getElementById(HOST_ID)?.remove();
  vi.restoreAllMocks();
});

describe("saved answers for choice questions, during a fill", () => {
  it("chooses the saved option in a select, a radio group and a combobox", async () => {
    document.body.innerHTML = FORM;
    const gender = combobox("g", "Gender", ["Female", "Male", "Prefer not to say"]);
    const { filled } = await fill([
      answer("Are you legally authorised to work in India?", "Yes"),
      answer("Will you require sponsorship?", "No"),
      answer("Gender", "Prefer not to say"),
      answer("Why us?", "Because"),
    ]);
    expect($<HTMLSelectElement>("#auth").value).toBe("y");
    expect($<HTMLInputElement>('input[value="0"]').checked).toBe(true);
    expect(gender.value()).toBe("Prefer not to say");
    expect($<HTMLInputElement>("#why").value).toBe("Because");
    expect(filled).toBe(4);
  });

  it("leaves a question whose saved answer matches no option or several, and says why", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    document.body.innerHTML = `
      <label for="a">Notice period</label>
      <select id="a"><option value="">--</option><option value="1">Yes</option><option value="2">yes</option></select>
      <label for="b">Are you legally authorised to work in India?</label>
      <select id="b"><option value="">--</option><option value="1">Yes</option><option value="2">No</option></select>`;
    const box = combobox("c", "Gender", ["Female", "Male"]);
    await fill([
      answer("Notice period", "Yes"),
      answer("Are you legally authorised to work in India?", "Maybe"),
      answer("Gender", "Other"),
    ]);
    expect($<HTMLSelectElement>("#a").value).toBe("");
    expect($<HTMLSelectElement>("#b").value).toBe("");
    expect(box.value()).toBe("");
    expect(document.getElementById("c-list")).toBeNull();
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"Notice period" not used: no single option is "Yes"'));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"Gender" not used: no single option is "Other"'));
  });

  it("ignores an 'a) ' prefix on options only when no option matches exactly", async () => {
    document.body.innerHTML = `
      <label for="a">Will you relocate?</label>
      <select id="a"><option value="">--</option><option value="1">a) Yes</option><option value="2">b) No</option></select>`;
    await fill([answer("Will you relocate?", "No")]);
    expect($<HTMLSelectElement>("#a").value).toBe("2");
  });

  it("lets the profile win on a choice it fills", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    document.body.innerHTML = `
      <label for="m">Work mode</label>
      <select id="m"><option value="">--</option><option value="o">Office</option><option value="r">Remote</option></select>`;
    await fill([answer("Work mode", "Office")], { version: 1, values: { workMode: ["remote"] } });
    expect($<HTMLSelectElement>("#m").value).toBe("r");
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"Work mode" skipped, the profile fills this field'));
  });

  it("uses the saved answer on a profile choice the profile leaves empty", async () => {
    document.body.innerHTML = `
      <label for="m">Work mode</label>
      <select id="m"><option value="">--</option><option value="o">Office</option><option value="r">Remote</option></select>`;
    await fill([answer("Work mode", "Office")]);
    expect($<HTMLSelectElement>("#m").value).toBe("o");
  });

  it("never changes a select, radio group or combobox that already has an answer", async () => {
    document.body.innerHTML = FORM;
    $<HTMLSelectElement>("#auth").value = "n";
    $<HTMLInputElement>('input[value="1"]').checked = true;
    const gender = combobox("g", "Gender", ["Female", "Male"], "Female");
    const { filled } = await fill([
      answer("Are you legally authorised to work in India?", "Yes"),
      answer("Will you require sponsorship?", "No"),
      answer("Gender", "Male"),
    ]);
    expect($<HTMLSelectElement>("#auth").value).toBe("n");
    expect($<HTMLInputElement>('input[value="1"]').checked).toBe(true);
    expect(gender.value()).toBe("Female");
    expect(filled).toBe(0);
  });
});

describe("the field picker on choice questions", () => {
  async function pickAndSave(target: Element, choice: string) {
    const saveAnswer = vi.fn(async () => {});
    const stop = startPicker(document, { saveAnswer });
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const root = document.getElementById(HOST_ID)!.shadowRoot!;
    await vi.waitFor(() => expect(root.querySelector("form")).not.toBeNull());
    const form = root.querySelector<HTMLFormElement>("form")!;
    const select = form.querySelector<HTMLSelectElement>('select[name="answer"]')!;
    const offered = [...select.options].map((o) => o.text);
    const question = form.querySelector<HTMLTextAreaElement>('[name="question"]')!.value;
    select.value = choice;
    form.requestSubmit();
    await vi.waitFor(() => expect(saveAnswer).toHaveBeenCalled());
    return { saveAnswer, offered, question, stop };
  }

  it("offers a select's options, saves the chosen text and selects it", async () => {
    document.body.innerHTML = FORM;
    const { saveAnswer, offered, question, stop } = await pickAndSave($("#auth"), "Yes");
    expect(question).toBe("Are you legally authorised to work in India?");
    expect(offered).toEqual(["Choose an answer", "Yes", "No"]);
    expect(saveAnswer).toHaveBeenCalledWith("Are you legally authorised to work in India?", "Yes");
    await vi.waitFor(() => expect($<HTMLSelectElement>("#auth").value).toBe("y"));
    stop();
  });

  it("picks a whole radio group from a click on one option's label", async () => {
    document.body.innerHTML = FORM;
    const { saveAnswer, offered, stop } = await pickAndSave($('input[value="1"]').closest("label")!, "No");
    expect(offered).toEqual(["Choose an answer", "Yes", "No"]);
    expect(saveAnswer).toHaveBeenCalledWith("Will you require sponsorship?", "No");
    await vi.waitFor(() => expect($<HTMLInputElement>('input[value="0"]').checked).toBe(true));
    expect($<HTMLInputElement>('input[value="1"]').checked).toBe(false);
    stop();
  });

  it("reads a combobox's options by opening it, then picks the saved one", async () => {
    document.body.innerHTML = "";
    const gender = combobox("g", "Gender", ["Female", "Male", "Prefer not to say"]);
    const { saveAnswer, offered, stop } = await pickAndSave($("#g"), "Prefer not to say");
    expect(offered).toEqual(["Choose an answer", "Female", "Male", "Prefer not to say"]);
    expect(saveAnswer).toHaveBeenCalledWith("Gender", "Prefer not to say");
    await vi.waitFor(() => expect(gender.value()).toBe("Prefer not to say"));
    stop();
  });

  it("refuses to save without a chosen option", async () => {
    document.body.innerHTML = FORM;
    const saveAnswer = vi.fn(async () => {});
    const stop = startPicker(document, { saveAnswer });
    $("#auth").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const root = document.getElementById(HOST_ID)!.shadowRoot!;
    await vi.waitFor(() => expect(root.querySelector("form")).not.toBeNull());
    root.querySelector<HTMLFormElement>("form")!.requestSubmit();
    await new Promise((r) => setTimeout(r, 0));
    expect(saveAnswer).not.toHaveBeenCalled();
    expect(root.querySelector(".error")!.textContent).toBe("Choose the answer to save.");
    stop();
  });

  it("still saves and fills a text answer", async () => {
    document.body.innerHTML = FORM;
    const saveAnswer = vi.fn(async () => {});
    const stop = startPicker(document, { saveAnswer });
    $("#why").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const root = document.getElementById(HOST_ID)!.shadowRoot!;
    const form = root.querySelector<HTMLFormElement>("form")!;
    form.querySelector<HTMLInputElement>('input[name="answer"]')!.value = "Because";
    form.requestSubmit();
    await vi.waitFor(() => expect($<HTMLInputElement>("#why").value).toBe("Because"));
    expect(saveAnswer).toHaveBeenCalledWith("Why us?", "Because");
    stop();
  });
});
