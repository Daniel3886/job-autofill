import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanQuestion, rawQuestionText } from "../content/signals";
import { HOST_ID, startPicker } from "./picker";

const click = (el: Element) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
const shadow = () => document.getElementById(HOST_ID)?.shadowRoot ?? null;
const flush = () => new Promise((r) => setTimeout(r, 0));

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

function setup(html: string) {
  document.body.innerHTML = html;
  const saveAnswer = vi.fn(async () => {});
  const onStop = vi.fn();
  stop = startPicker(document, { saveAnswer, onStop });
  return { saveAnswer, onStop };
}

describe("question text", () => {
  it("cleans labels and falls back to nearby text or the placeholder", () => {
    expect(cleanQuestion("  Czy znasz   Dockera?:*  ")).toBe("Czy znasz Dockera?");
    document.body.innerHTML = `
      <label for="a">Czy znasz Dockera? *</label><input id="a">
      <div><div>Uwagi:</div><textarea id="b"></textarea></div>
      <input id="c" placeholder="Link do portfolio">`;
    const q = (id: string) => rawQuestionText(document.getElementById(id)!);
    expect([q("a"), q("b"), q("c")]).toEqual(["Czy znasz Dockera?", "Uwagi", "Link do portfolio"]);
  });
});

describe("field picker", () => {
  it("opens a panel with the question filled in, then saves and fills", async () => {
    const { saveAnswer, onStop } = setup(`<label for="d">Czy znasz Dockera? *</label><input id="d">`);
    const input = document.getElementById("d") as HTMLInputElement;
    click(input);

    const panel = shadow()!.querySelector("form")!;
    const question = panel.querySelector<HTMLTextAreaElement>('[name="question"]')!;
    const answer = panel.querySelector<HTMLInputElement>('[name="answer"]')!;
    expect(question.value).toBe("Czy znasz Dockera?");

    answer.value = "tak";
    vi.useFakeTimers();
    panel.requestSubmit();
    await vi.waitFor(() => expect(saveAnswer).toHaveBeenCalledWith("Czy znasz Dockera?", "tak"));
    expect(input.value).toBe("tak");
    vi.runAllTimers();
    expect(document.getElementById(HOST_ID)).toBeNull();
    expect(onStop).toHaveBeenCalled();
  });

  it("starts the answer from what is already typed in the field", () => {
    setup(`<label for="d">Uwagi</label><textarea id="d">Dostępny od 1 grudnia</textarea>`);
    click(document.getElementById("d")!);
    expect(shadow()!.querySelector<HTMLInputElement>('[name="answer"]')!.value).toBe("Dostępny od 1 grudnia");
  });

  it("refuses an empty answer", async () => {
    const { saveAnswer } = setup(`<label for="d">Uwagi</label><input id="d">`);
    click(document.getElementById("d")!);
    const panel = shadow()!.querySelector("form")!;
    panel.requestSubmit();
    await flush();
    expect(saveAnswer).not.toHaveBeenCalled();
    expect(panel.querySelector(".error")!.textContent).toBe("Type the answer to save.");
  });

  it("ignores clicks on things that are not text fields and blocks the page's own click", () => {
    setup(`<a id="link" href="#x">Apply</a><input id="box" type="checkbox">`);
    const pageClick = vi.fn();
    document.getElementById("link")!.addEventListener("click", pageClick);
    click(document.getElementById("link")!);
    click(document.getElementById("box")!);
    expect(shadow()!.querySelector("form")).toBeNull();
    expect(pageClick).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const { onStop } = setup(`<input id="d">`);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById(HOST_ID)).toBeNull();
    expect(onStop).toHaveBeenCalled();
  });
});
