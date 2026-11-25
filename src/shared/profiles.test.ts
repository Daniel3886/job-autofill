import { describe, expect, it } from "vitest";
import type { Profile } from "./profile";
import {
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
    values: { firstName: "Daniel", email: "d@example.com", tickRequiredConsent: "yes", city: "Warszawa", workMode: ["remote"] },
    languages: [{ language: "en", level: "C1" }],
    salaries: [{ amount: "15000", contract: "b2b", period: "month", basis: "net" }],
  };

  it("keeps name, email, phone and settings shared, and the rest in the profile", () => {
    const { global, own } = splitProfile(whole);
    expect(global.values).toEqual({ firstName: "Daniel", email: "d@example.com", tickRequiredConsent: "yes" });
    expect(own).toEqual({ values: { city: "Warszawa", workMode: ["remote"] }, languages: whole.languages, salaries: whole.salaries });
  });

  it("merges back to the same profile, with shared values winning over stale copies in a profile", () => {
    const { global, own } = splitProfile(whole);
    expect(mergeProfile(global, { id: "a", name: "A", ...own })).toEqual(whole);
    const stale = { id: "a", name: "A", values: { firstName: "Old", city: "Kraków" } };
    expect(mergeProfile(global, stale).values).toEqual({
      firstName: "Daniel",
      email: "d@example.com",
      tickRequiredConsent: "yes",
      city: "Kraków",
    });
  });
});
