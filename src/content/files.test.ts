import { describe, expect, it, vi } from "vitest";
import { base64ToBytes, bytesToBase64, formatSize, type StoredFile } from "../shared/files";
import type { Profile } from "../shared/profile";
import { collectTargets } from "./adapters";
import { acceptsFile } from "./drivers/file";
import { isCvQuestion } from "./fileRules";
import { planFills, type MainWorldBridge } from "./plan";
import { normalize } from "./text";

const CV: StoredFile = {
  name: "Jan_Kowalski_CV.pdf",
  type: "application/pdf",
  size: 4,
  dataBase64: btoa("%PDF"),
  savedAt: "2026-11-04T10:00:00.000Z",
};

const PROFILE: Profile = { version: 1, values: { firstName: "Jan" } };
const bridge: MainWorldBridge = {
  readSelectize: async () => ({}),
  setSelectize: async () => 0,
  searchSelectize: async () => null,
};

async function plan(html: string, cv: StoredFile | null = CV) {
  document.body.innerHTML = html;
  const loadCv = vi.fn(async () => cv);
  const actions = await planFills(collectTargets(document, false), PROFILE, bridge, { loadCv });
  return { actions: actions.filter((a) => a.kind === "file"), loadCv };
}

describe("base64 helpers", () => {
  it("round-trips binary data, including bytes above 127", () => {
    const bytes = new Uint8Array([0, 37, 80, 68, 70, 200, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });

  it("handles inputs larger than one chunk", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("formats sizes", () => {
    expect(formatSize(900)).toBe("900 B");
    expect(formatSize(240 * 1024)).toBe("240 KB");
    expect(formatSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});

describe("isCvQuestion", () => {
  it.each([
    ["CV", true],
    ["Załącz CV *", true],
    ["Resume", true],
    ["Życiorys", true],
    ["List motywacyjny", false],
    ["CV / list motywacyjny", false],
    ["Portfolio", false],
  ])("%s -> %s", (q, expected) => {
    expect(isCvQuestion(normalize(q))).toBe(expected);
  });
});

describe("acceptsFile", () => {
  const input = (accept: string) => Object.assign(document.createElement("input"), { type: "file", accept });
  it("checks extensions, exact types and wildcards", () => {
    expect(acceptsFile(input(""), "cv.pdf", "application/pdf")).toBe(true);
    expect(acceptsFile(input(".pdf,.docx"), "CV.PDF", "application/pdf")).toBe(true);
    expect(acceptsFile(input("application/pdf"), "cv.pdf", "application/pdf")).toBe(true);
    expect(acceptsFile(input("application/*"), "cv.pdf", "application/pdf")).toBe(true);
    expect(acceptsFile(input(".doc,.docx"), "cv.pdf", "application/pdf")).toBe(false);
  });
});

describe("CV targets", () => {
  const TRAFFIT_CV = `
    <div class="form-group">
      <label class="required" for="cvf">CV</label>
      <span class="required-star">*</span>
      <div class="custom-file"><input type="file" id="cvf" style="display:none"><label>Click here to add a file</label></div>
    </div>`;

  it("finds a labelled CV input even when it is hidden", async () => {
    const { actions } = await plan(TRAFFIT_CV);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "file", file: { name: "Jan_Kowalski_CV.pdf" } });
  });

  it("uploads to the CV field and not the cover letter field", async () => {
    const { actions } = await plan(`
      <label for="cl">List motywacyjny</label><input type="file" id="cl">
      <label for="cv">Załącz CV</label><input type="file" id="cv">`);
    expect(actions.map((a) => (a as { element: HTMLInputElement }).element.id)).toEqual(["cv"]);
  });

  it("respects the accept attribute", async () => {
    const { actions } = await plan(`<label for="cv">CV</label><input type="file" id="cv" accept=".docx">`);
    expect(actions).toHaveLength(0);
  });

  it("does not load the CV when the page has no CV field", async () => {
    const { loadCv } = await plan(`<label for="n">Imię</label><input id="n">`);
    expect(loadCv).not.toHaveBeenCalled();
  });

  it("skips the field when no CV is saved", async () => {
    const { actions } = await plan(TRAFFIT_CV, null);
    expect(actions).toHaveLength(0);
  });
});
