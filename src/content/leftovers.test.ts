import { afterEach, describe, expect, it, vi } from "vitest";
import { findLeftovers } from "./leftovers";
import { closeReport, REPORT_HOST_ID, showReport } from "./report";

function leftovers(html: string) {
  document.body.innerHTML = html;
  return findLeftovers(document, false);
}

describe("findLeftovers", () => {
  it("lists empty fields, required ones first, and skips filled ones", () => {
    expect(
      leftovers(`
        <label for="a">First name</label><input id="a" value="Daniel">
        <label for="b">Why do you want to join us?</label><textarea id="b"></textarea>
        <label for="c">Expected salary *</label><input id="c">
        <label for="d">GitHub</label><input id="d" required>
        <label for="e">Kraj</label><select id="e"><option value="">Wybierz</option><option value="PL">Polska</option></select>
        <label for="f">Notice</label><select id="f"><option value="">--</option><option value="1" selected>1 month</option></select>`),
    ).toEqual([
      { question: "Expected salary", required: true },
      { question: "GitHub", required: true },
      { question: "Why do you want to join us?", required: false },
      { question: "Kraj", required: false },
    ]);
  });

  it("leaves out hidden, aria-hidden and honeypot controls", () => {
    expect(
      leftovers(`
        <div hidden><label for="a">Hidden</label><input id="a"></div>
        <div aria-hidden="true"><label for="b">Aria hidden</label><input id="b"></div>
        <label for="c">Email</label><input id="c" name="fake_email">
        <label for="d">Please leave this field blank</label><input id="d">
        <label for="e">Phone</label><input id="e">`),
    ).toEqual([{ question: "Phone", required: false }]);
  });

  it("lists a radio group with nothing chosen once, and not a group that has an answer", () => {
    expect(
      leftovers(`
        <fieldset><legend>Work mode *</legend>
          <label><input type="radio" name="m"> Office</label><label><input type="radio" name="m"> Remote</label>
        </fieldset>
        <fieldset><legend>Relocation</legend>
          <label><input type="radio" name="r" checked> Yes</label><label><input type="radio" name="r"> No</label>
        </fieldset>`),
    ).toEqual([{ question: "Work mode", required: true }]);
  });

  it("lists required checkboxes, empty comboboxes and CV inputs, but not optional checkboxes", () => {
    expect(
      leftovers(`
        <label><input type="checkbox" required> I accept the privacy policy</label>
        <label><input type="checkbox"> Send me job alerts</label>
        <label id="ql" for="q">Country</label><input id="q" role="combobox" aria-labelledby="ql">
        <label for="cv">CV</label><input id="cv" type="file">`),
    ).toEqual([
      { question: "I accept the privacy policy", required: true },
      { question: "Country", required: false },
      { question: "CV", required: false },
    ]);
  });

  it("skips controls without a question and the extension's own panels", () => {
    document.body.innerHTML = `<input id="nameless"><div id="job-autofill-picker"></div>`;
    const root = document.querySelector("#job-autofill-picker")!.attachShadow({ mode: "open" });
    root.innerHTML = `<label for="x">Answer</label><input id="x">`;
    expect(findLeftovers(document, false)).toEqual([]);
  });
});

describe("report panel", () => {
  afterEach(() => {
    closeReport();
    vi.useRealTimers();
  });

  const panel = () => document.getElementById(REPORT_HOST_ID)?.shadowRoot;

  it("shows the questions left, marks required ones, and closes on the button", () => {
    document.body.innerHTML = "";
    showReport([
      { question: "Expected salary", required: true },
      { question: "Why us?", required: false },
    ]);
    expect(panel()!.querySelector("h2")!.textContent).toBe("Left for you (2)");
    const items = [...panel()!.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["Expected salaryrequired", "Why us?"]);
    panel()!.querySelector("button")!.click();
    expect(document.getElementById(REPORT_HOST_ID)).toBeNull();
  });

  it("closes on Escape", () => {
    document.body.innerHTML = "";
    showReport([{ question: "Why us?", required: false }]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById(REPORT_HOST_ID)).toBeNull();
  });

  it("replaces an earlier report instead of stacking a second one", () => {
    document.body.innerHTML = "";
    showReport([{ question: "First", required: false }]);
    showReport([{ question: "Second", required: false }]);
    expect(document.querySelectorAll(`#${REPORT_HOST_ID}`)).toHaveLength(1);
    expect(panel()!.querySelector("li")!.textContent).toBe("Second");
  });

  it("says the form is filled when nothing is left, and dismisses itself", () => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    showReport([]);
    expect(panel()!.textContent).toContain("Everything this extension can fill is filled");
    vi.advanceTimersByTime(4000);
    expect(document.getElementById(REPORT_HOST_ID)).toBeNull();
  });
});
