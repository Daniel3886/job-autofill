import { describe, expect, it } from "vitest";
import { collectFillableInputs, setInputValue } from "./fill";
import { matchInputs } from "./matcher";
import { normalize } from "./text";

function render(html: string): HTMLInputElement[] {
  document.body.innerHTML = html;
  // jsdom has no layout, so skip the visibility check in tests.
  return collectFillableInputs(document, false);
}

function matchedIds(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of matchInputs(render(html))) result[m.input.id || m.input.name] = m.fieldId;
  return result;
}

describe("normalize", () => {
  it("strips Polish diacritics, case, punctuation and camelCase", () => {
    expect(normalize("Imię *")).toBe("imie");
    expect(normalize("Telefon komórkowy")).toBe("telefon komorkowy");
    expect(normalize("Miejscowość")).toBe("miejscowosc");
    expect(normalize("firstName")).toBe("first name");
    expect(normalize("last_name")).toBe("last name");
  });
});

describe("matchInputs", () => {
  it("matches a Polish form with <label for> (the screenshot form)", () => {
    expect(
      matchedIds(`
        <label for="a">Imię *</label><input id="a">
        <label for="b">Nazwisko *</label><input id="b">
        <label for="c">Email *</label><input id="c" placeholder="example@domain.com">
        <label for="d">Telefon komórkowy *</label><input id="d">
        <label for="e">Oczekiwania finansowe (brutto UoP, netto B2B) *</label><input id="e">
      `),
    ).toEqual({ a: "firstName", b: "lastName", c: "email", d: "phone", e: "salary" });
  });

  it("uses the autocomplete attribute even with unhelpful labels", () => {
    expect(
      matchedIds(`
        <input id="x1" autocomplete="given-name">
        <input id="x2" autocomplete="family-name">
        <input id="x3" type="email">
        <input id="x4" type="tel">
      `),
    ).toEqual({ x1: "firstName", x2: "lastName", x3: "email", x4: "phone" });
  });

  it("reads wrapping labels, aria-label and name attributes", () => {
    expect(
      matchedIds(`
        <label>First name <input id="f"></label>
        <input id="s" aria-label="Surname">
        <input name="city">
      `),
    ).toEqual({ f: "firstName", s: "lastName", city: "city" });
  });

  it("falls back to text just before the input when there is no label", () => {
    expect(
      matchedIds(`
        <div><span>Nazwisko</span><div><input id="n"></div></div>
      `),
    ).toEqual({ n: "lastName" });
  });

  it("leaves unrelated inputs alone", () => {
    expect(
      matchedIds(`
        <label for="q">Company</label><input id="q">
        <label for="w">Notes</label><input id="w">
      `),
    ).toEqual({});
  });

  it("fills each field only once", () => {
    const matches = matchInputs(
      render(`
        <label for="e1">Email</label><input id="e1" type="email">
        <label for="e2">Email</label><input id="e2">
      `),
    );
    expect(matches.map((m) => m.input.id)).toEqual(["e1"]);
  });
});

describe("collectFillableInputs", () => {
  it("skips non-text, disabled, readonly and already-filled inputs", () => {
    const inputs = render(`
      <input id="ok">
      <input id="pw" type="password">
      <input id="dis" disabled>
      <input id="ro" readonly>
      <input id="full" value="typed by hand">
      <input id="cb" type="checkbox">
    `);
    expect(inputs.map((i) => i.id)).toEqual(["ok"]);
  });
});

describe("setInputValue", () => {
  it("sets the value and fires input and change events", () => {
    const [input] = render(`<input id="a">`);
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));
    setInputValue(input, "Daniel");
    expect(input.value).toBe("Daniel");
    expect(events).toEqual(["input", "change"]);
  });
});
