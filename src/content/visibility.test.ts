import { afterEach, describe, expect, it, vi } from "vitest";
import { collectTargets } from "./adapters";
import { isPersonFacing } from "./visibility";

function targetIds(html: string, checkVisibility = false): string[] {
  document.body.innerHTML = html;
  return collectTargets(document, checkVisibility).flatMap((t) => {
    if (t.kind === "radio") return [t.radios[0].name];
    if (t.kind === "answer") return [];
    return [t.element.id];
  });
}

describe("honeypots and hidden fields", () => {
  afterEach(() => vi.restoreAllMocks());

  it("skips inputs named or labelled as traps, and fills the real ones next to them", () => {
    const ids = targetIds(`
      <label for="trap">Email</label><input id="trap" type="email" autocomplete="email" name="fake_email">
      <label for="email">Email</label><input id="email" name="email">
      <label for="nick">First name</label><input id="nick" autocomplete="given-name" name="nickname_hpcsaf">
      <label for="blank">Phone (please leave this field blank)</label><input id="blank" type="tel" name="phone">
      <label for="phone">Phone</label><input id="phone" name="mobile">`);
    expect(ids).toEqual(["email", "phone"]);
  });

  it("skips controls inside hidden, aria-hidden or inert containers", () => {
    const ids = targetIds(`
      <div hidden><label for="a">First name</label><input id="a"></div>
      <div aria-hidden="true"><label for="b">Last name</label><input id="b"></div>
      <div inert><label for="c">Kraj</label><select id="c"><option>Polska</option></select></div>
      <div aria-hidden="true"><label for="cv">CV</label><input id="cv" type="file"></div>
      <div aria-hidden="true"><p>Model pracy</p><div><label><input type="radio" name="mode"> zdalny</label></div></div>
      <label for="d">Email</label><input id="d">`);
    expect(ids).toEqual(["d"]);
  });

  it("keeps a file input and radios that are styled out of sight but not hidden by markup", () => {
    const ids = targetIds(`
      <label for="cv">CV</label><input id="cv" type="file" style="opacity:0;width:0;height:0">
      <div><p>Model pracy</p><div>
        <label><input type="radio" name="mode" style="display:none"> zdalny</label>
        <label><input type="radio" name="mode" style="display:none"> stacjonarny</label>
      </div></div>`);
    expect(ids).toEqual(["mode", "cv"]);
  });

  it("treats a control pushed off the page as hidden when layout is checked", () => {
    document.body.innerHTML = `<input id="off"><input id="on">`;
    const box = (right: number, bottom: number) => ({ right, bottom }) as DOMRect;
    const off = document.querySelector<HTMLInputElement>("#off")!;
    const on = document.querySelector<HTMLInputElement>("#on")!;
    for (const el of [off, on]) vi.spyOn(el, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    vi.spyOn(off, "getBoundingClientRect").mockReturnValue(box(-9800, 20));
    vi.spyOn(on, "getBoundingClientRect").mockReturnValue(box(300, 20));
    expect(isPersonFacing(off, true)).toBe(false);
    expect(isPersonFacing(on, true)).toBe(true);
    expect(isPersonFacing(off, false)).toBe(true);
  });
});
