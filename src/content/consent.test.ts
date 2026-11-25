import { describe, expect, it, vi } from "vitest";
import { CONSENT_SETTING, type Profile } from "../shared/profile";
import { collectTargets } from "./adapters";
import { executeActions, planFills, type MainWorldBridge } from "./plan";

const bridge: MainWorldBridge = {
  readSelectize: vi.fn(async () => ({})),
  setSelectize: vi.fn(async () => 0),
  searchSelectize: vi.fn(async () => null),
};

const ON: Profile = { version: 1, values: { [CONSENT_SETTING]: "yes" } };

async function fill(html: string, profile = ON) {
  document.body.innerHTML = html;
  const actions = await planFills(collectTargets(document, false), profile, bridge);
  return executeActions(actions, bridge);
}

const checked = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!.checked;

const FORM = `
  <label><input type="checkbox" id="pl" required> Wyrażam zgodę na przetwarzanie moich danych osobowych w celu rekrutacji.</label>
  <div><input type="checkbox" id="en"><span>I consent to the processing of my personal data for this application *</span></div>
  <label><input type="checkbox" id="future"> * Wyrażam zgodę na przetwarzanie moich danych osobowych w przyszłych rekrutacjach.</label>
  <label><input type="checkbox" id="optional"> I agree to the processing of my personal data for this application.</label>
  <label><input type="checkbox" id="news" required> Subscribe to our newsletter (privacy policy applies)</label>
  <label><input type="checkbox" id="terms" required> I accept the terms of service</label>`;

describe("required data-processing consent", () => {
  it("ticks only the required consent for this application when the setting is on", async () => {
    const filled = await fill(FORM);
    expect(checked("pl")).toBe(true);
    expect(checked("en")).toBe(true);
    expect(checked("future")).toBe(false);
    expect(checked("optional")).toBe(false);
    expect(checked("news")).toBe(false);
    expect(checked("terms")).toBe(false);
    expect(filled).toBe(2);
  });

  it("ticks nothing while the setting is off", async () => {
    expect(await fill(FORM, { version: 1, values: {} })).toBe(0);
    expect(checked("pl")).toBe(false);
    expect(checked("en")).toBe(false);
  });

  it("leaves a box that is already ticked, disabled or hidden", async () => {
    const filled = await fill(`
      <label><input type="checkbox" id="a" required checked> Zgoda na przetwarzanie moich danych osobowych</label>
      <label><input type="checkbox" id="b" required disabled> Zgoda na przetwarzanie moich danych osobowych</label>
      <div aria-hidden="true"><label><input type="checkbox" id="c" required> Zgoda na przetwarzanie moich danych osobowych</label></div>`);
    expect(filled).toBe(0);
    expect(checked("a")).toBe(true);
    expect(checked("b")).toBe(false);
    expect(checked("c")).toBe(false);
  });

  it("does not read a shared row of several boxes as one consent", async () => {
    expect(
      await fill(`
        <div>* Zgoda na przetwarzanie moich danych osobowych
          <input type="checkbox" id="x"> <input type="checkbox" id="y"> Regulamin</div>`),
    ).toBe(0);
  });
});
