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

describe("required consent and terms boxes", () => {
  it("ticks only the required consent and terms boxes when the setting is on", async () => {
    const filled = await fill(FORM);
    expect(checked("pl")).toBe(true);
    expect(checked("en")).toBe(true);
    expect(checked("future")).toBe(false);
    expect(checked("optional")).toBe(false);
    expect(checked("news")).toBe(false);
    expect(checked("terms")).toBe(true);
    expect(filled).toBe(3);
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

  it("ticks required regulamin and terms-and-conditions boxes", async () => {
    const filled = await fill(`
      <label><input type="checkbox" id="reg" required> Zapoznałem się z regulaminem serwisu i akceptuję jego postanowienia.</label>
      <label><input type="checkbox" id="tc"> I accept the Terms &amp; Conditions *</label>`);
    expect(checked("reg")).toBe(true);
    expect(checked("tc")).toBe(true);
    expect(filled).toBe(2);
  });

  it("leaves an optional terms box, and a required one that also signs up for a newsletter", async () => {
    const filled = await fill(`
      <label><input type="checkbox" id="opt"> Akceptuję regulamin</label>
      <label><input type="checkbox" id="mixed" required> I accept the terms of service and want to receive the newsletter</label>`);
    expect(filled).toBe(0);
    expect(checked("opt")).toBe(false);
    expect(checked("mixed")).toBe(false);
  });

  it("never ticks a box inside a captcha widget", async () => {
    const filled = await fill(`
      <div class="g-recaptcha"><label><input type="checkbox" id="rc" required> I accept the terms of service</label></div>
      <div id="hcaptcha"><label><input type="checkbox" id="hc" required> Akceptuję regulamin</label></div>
      <div title="Cloudflare Turnstile"><label><input type="checkbox" id="ts" required> Privacy policy *</label></div>`);
    expect(filled).toBe(0);
    expect(checked("rc")).toBe(false);
    expect(checked("hc")).toBe(false);
    expect(checked("ts")).toBe(false);
  });

  it("ticks no terms box while the setting is off", async () => {
    expect(
      await fill(
        `<label><input type="checkbox" id="reg" required> Akceptuję regulamin</label>
        <label><input type="checkbox" id="tc" required> I accept the terms and conditions</label>`,
        { version: 1, values: {} },
      ),
    ).toBe(0);
    expect(checked("reg")).toBe(false);
    expect(checked("tc")).toBe(false);
  });

  it("does not read a shared row of several boxes as one consent", async () => {
    expect(
      await fill(`
        <div>* Zgoda na przetwarzanie moich danych osobowych
          <input type="checkbox" id="x"> <input type="checkbox" id="y"> Regulamin</div>`),
    ).toBe(0);
  });
});
