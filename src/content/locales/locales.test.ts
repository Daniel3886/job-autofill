import { describe, expect, it } from "vitest";
import { CHOICE_FIELDS, LANGUAGES, LANGUAGE_LEVELS } from "../../shared/profile";
import { LOCALES, tiers, words, type Locale } from ".";
import en from "./en.json";
import pl from "./pl.json";

const FIELD_IDS = ["firstName", "lastName", "email", "phone", "city", "salary", "linkedin", "github", "website"];

describe.each([
  ["en", en as Locale],
  ["pl", pl as Locale],
])("%s.json", (_name, locale) => {
  it("only uses known field, question and option ids", () => {
    for (const id of Object.keys(locale.fields ?? {})) expect(FIELD_IDS).toContain(id);
    for (const id of Object.keys(locale.questions ?? {})) expect(CHOICE_FIELDS.map((f) => f.id)).toContain(id);
    for (const [fieldId, options] of Object.entries(locale.options ?? {})) {
      const field = CHOICE_FIELDS.find((f) => f.id === fieldId);
      expect(field, fieldId).toBeDefined();
      for (const optionId of Object.keys(options)) expect(field!.options.map((o) => o.value)).toContain(optionId);
    }
  });

  it("only uses known language codes and levels", () => {
    for (const code of Object.keys(locale.languages ?? {})) expect(LANGUAGES.map((l) => l.code)).toContain(code);
    for (const level of Object.keys(locale.levels ?? {})) expect(LANGUAGE_LEVELS.map((l) => l.value)).toContain(level);
  });

  it("has a name for every supported language", () => {
    for (const { code } of LANGUAGES) expect(locale.languages?.[code]?.length, code).toBeGreaterThan(0);
  });
});

describe("loading", () => {
  it("normalises words written with Polish letters", () => {
    expect(words((l) => l.fields?.firstName?.labels)).toContain("imie");
    expect(words((l) => l.languages?.it)).toEqual(["italian", "wloski", "wloskiego"]);
  });

  it("merges synonym tiers by position across locales", () => {
    expect(tiers((l) => l.options?.availability?.["1m"])).toEqual([
      ["1 month", "one month", "1 miesiac"],
      ["30 days", "30 dni"],
    ]);
  });

  it("picks up words from an added locale", () => {
    const de: Locale = { fields: { firstName: { labels: ["Vorname"] } } };
    expect(words((l) => l.fields?.firstName?.labels, [...LOCALES, de])).toContain("vorname");
  });
});
