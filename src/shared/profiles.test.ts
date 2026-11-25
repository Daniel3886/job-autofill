import { describe, expect, it } from "vitest";
import type { Profile } from "./profile";
import {
  PROFILE_COUNTRY,
  effectiveProfile,
  mergeProfile,
  nextProfileId,
  profileBadge,
  profileMenuItems,
  splitProfile,
  withoutProfile,
  type ProfilesState,
} from "./profiles";

const STATE: ProfilesState = {
  activeId: "b",
  list: [
    { id: "a", name: "Backend – EN", values: {} },
    { id: "b", name: "Frontend – PL", values: {} },
    { id: "c", name: "Data", values: {} },
  ],
};

describe("switching profiles", () => {
  it("moves to the next profile and wraps around after the last", () => {
    expect(nextProfileId(STATE)).toBe("c");
    expect(nextProfileId({ ...STATE, activeId: "c" })).toBe("a");
  });

  it("starts from the first profile when the active id is unknown, and stays put with one profile", () => {
    expect(nextProfileId({ ...STATE, activeId: "gone" })).toBe("a");
    expect(nextProfileId({ activeId: "a", list: [STATE.list[0]] })).toBe("a");
  });

  it("lists one menu item per profile with only the active one checked", () => {
    expect(profileMenuItems(STATE)).toEqual([
      { id: "profile:a", title: "Backend – EN", checked: false },
      { id: "profile:b", title: "Frontend – PL", checked: true },
      { id: "profile:c", title: "Data", checked: false },
    ]);
  });

  it("checks the first profile when the active id is unknown", () => {
    expect(profileMenuItems({ ...STATE, activeId: "gone" }).map((i) => i.checked)).toEqual([true, false, false]);
  });

  it("shows the first two letters of the new profile on the icon", () => {
    expect(profileBadge("  Frontend – PL")).toBe("Fr");
  });
});

describe("deleting profiles", () => {
  it("never deletes the last profile", () => {
    expect(() => withoutProfile({ activeId: "a", list: [STATE.list[0]] }, "a")).toThrow(/last profile/);
  });

  it("makes the profile before the deleted active one active", () => {
    expect(withoutProfile(STATE, "b")).toEqual({ activeId: "a", list: [STATE.list[0], STATE.list[2]] });
    expect(withoutProfile({ ...STATE, activeId: "a" }, "a").activeId).toBe("b");
  });

  it("keeps the active profile when another one is deleted, and ignores an unknown id", () => {
    expect(withoutProfile(STATE, "c").activeId).toBe("b");
    expect(withoutProfile(STATE, "gone")).toBe(STATE);
  });
});

describe("shared and per-profile values", () => {
  const whole: Profile = {
    version: 1,
    values: {
      firstName: "Daniel",
      email: "d@example.com",
      tickRequiredConsent: "yes",
      linkedin: "https://www.linkedin.com/in/daniel",
      country: "Polska",
      city: "Warszawa",
      workMode: ["remote"],
    },
    languages: [{ language: "en", level: "C1" }],
    salaries: [{ amount: "15000", contract: "b2b", period: "month", basis: "net" }],
  };

  it("shares name, contact, links, country, languages and settings, and keeps the rest in the profile", () => {
    const { global, own } = splitProfile(whole);
    expect(global.values).toEqual({
      firstName: "Daniel",
      email: "d@example.com",
      tickRequiredConsent: "yes",
      linkedin: "https://www.linkedin.com/in/daniel",
      country: "Polska",
    });
    expect(global.languages).toEqual(whole.languages);
    expect(own).toEqual({ values: { city: "Warszawa", workMode: ["remote"] }, salaries: whole.salaries });
  });

  it("fills with a profile's own country, and with the default when the profile has none", () => {
    const { global } = splitProfile(whole);
    const de = { id: "de", name: "DE", values: { [PROFILE_COUNTRY]: "Deutschland" } };
    const plain = { id: "p", name: "P", values: { [PROFILE_COUNTRY]: "" } };
    expect(effectiveProfile(mergeProfile(global, de)).values.country).toBe("Deutschland");
    expect(effectiveProfile(mergeProfile(global, plain)).values.country).toBe("Polska");
    expect(effectiveProfile(mergeProfile(global, de)).values).not.toHaveProperty(PROFILE_COUNTRY);
    // The options page sees both, so it can show the default next to the override.
    expect(mergeProfile(global, de).values).toMatchObject({ country: "Polska", [PROFILE_COUNTRY]: "Deutschland" });
  });

  it("reads links, languages and the country a profile held before they were shared", () => {
    const shared: Profile = { version: 1, values: { firstName: "Daniel" } };
    const old = {
      id: "a",
      name: "A",
      values: { city: "Kraków", github: "https://github.com/daniel", country: "Polska" },
      languages: [{ language: "de", level: "B1" }],
    };
    const merged = mergeProfile(shared, old);
    expect(merged.values).toMatchObject({ github: "https://github.com/daniel", country: "Polska" });
    expect(merged.values).not.toHaveProperty(PROFILE_COUNTRY);
    expect(merged.languages).toEqual(old.languages);

    // Once a default country is shared, a different country the profile held becomes its own.
    const withDefault = mergeProfile({ version: 1, values: { country: "Niemcy" } }, old);
    expect(withDefault.values).toMatchObject({ country: "Niemcy", [PROFILE_COUNTRY]: "Polska" });
  });

  it("merges back to the same profile, with shared values winning over stale copies in a profile", () => {
    const { global, own } = splitProfile(whole);
    expect(mergeProfile(global, { id: "a", name: "A", ...own })).toEqual(whole);
    const stale = { id: "a", name: "A", values: { firstName: "Old", city: "Kraków" } };
    expect(mergeProfile(global, stale).values).toEqual({
      firstName: "Daniel",
      email: "d@example.com",
      tickRequiredConsent: "yes",
      linkedin: "https://www.linkedin.com/in/daniel",
      country: "Polska",
      city: "Kraków",
    });
  });
});
