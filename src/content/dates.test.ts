import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../shared/profile";
import { collectTargets } from "./adapters";
import { dateFormat, formatDate, startDate } from "./dates";
import { executeActions, planFills, type MainWorldBridge } from "./plan";

const bridge: MainWorldBridge = {
  readSelectize: vi.fn(async () => ({})),
  setSelectize: vi.fn(async () => 0),
  searchSelectize: vi.fn(async () => null),
};

const TODAY = new Date(2026, 0, 31);

async function fill(html: string, availability = "2w") {
  document.body.innerHTML = html;
  const profile: Profile = { version: 1, values: { availability } };
  const actions = await planFills(collectTargets(document, false), profile, bridge, undefined, TODAY);
  return executeActions(actions, bridge);
}

const value = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!.value;

describe("start date", () => {
  it("adds weeks and calendar months to today, clamping to the month's last day", () => {
    expect(startDate("immediately", TODAY)).toEqual(new Date(2026, 0, 31));
    expect(startDate("2w", TODAY)).toEqual(new Date(2026, 1, 14));
    expect(startDate("1m", TODAY)).toEqual(new Date(2026, 1, 28));
    expect(startDate("3m", TODAY)).toEqual(new Date(2026, 3, 30));
    expect(startDate("", TODAY)).toBeNull();
  });

  it("reads the format a placeholder shows, including the Polish RRRR", () => {
    expect(dateFormat("dd.mm.yyyy")).toBe("DD.MM.YYYY");
    expect(dateFormat("RRRR-MM-DD")).toBe("RRRR-MM-DD");
    expect(dateFormat("Select a date")).toBeNull();
    expect(dateFormat("MM/YYYY")).toBeNull();
    expect(formatDate(new Date(2026, 1, 14), "MM/DD/YYYY")).toBe("02/14/2026");
  });

  it("fills a start-date box in the format it asks for, and a native date input", async () => {
    await fill(`
      <label for="a">Data rozpoczęcia pracy</label><input id="a" placeholder="DD.MM.RRRR">
      <label for="b">Earliest start date</label><input id="b" type="date">`);
    expect(value("a")).toBe("14.02.2026");
    expect(value("b")).toBe("2026-02-14");
  });

  it("leaves date boxes that are not about the start date, have no known format, or are filled", async () => {
    await fill(`
      <label for="birth">Date of birth</label><input id="birth" type="date">
      <label for="free">Start date</label><input id="free" placeholder="e.g. next month">
      <label for="set">Available from</label><input id="set" type="date" value="2026-03-01">`);
    expect(value("birth")).toBe("");
    expect(value("free")).toBe("");
    expect(value("set")).toBe("2026-03-01");
  });

  it("leaves a start-date box empty when no availability is saved", async () => {
    await fill(`<label for="b">Start date</label><input id="b" type="date">`, "");
    expect(value("b")).toBe("");
  });
});
