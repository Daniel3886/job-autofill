import { describe, expect, it } from "vitest";
import type { Profile, SalaryExpectation } from "../../shared/profile";
import { CHOICE_RULE_BY_ID, classifyQuestion } from "./choiceRules";
import { LANGUAGE_LEVEL_RULE } from "./languages";
import { chooseChoiceOptions } from "./optionMatch";
import { matchSalaryOption, parseSalaryRange, salaryFor } from "./salary";
import { normalize } from "../text";

const opts = (texts: string[]) => texts.map((text, i) => ({ value: String(i), text }));
const rule = (id: string) => CHOICE_RULE_BY_ID.get(id)!;

const TRAFFIT_AVAILABILITY = opts([
  'a) "od zaraz"',
  "b) 1 tydzień",
  "c) 2 tygodnie",
  "d) 30 dni",
  "e) 1 miesiąc (ze skutkiem na koniec miesiąca)",
  "f) 2 miesiące",
  "g) 3 miesiące",
]);
const TRAFFIT_WORK_MODE = opts([
  "a) stacjonarny",
  "b) hybrydowy - 2-3 dni w tygodniu w biurze",
  "c) hybrydowy - 3-4 dni w tygodniu w biurze",
  "d) hybrydowy - 1-2 dni w miesiącu w biurze",
  "e) hybrydowy - 3-4 dni w miesiącu w biurze",
  "f) zdalny",
]);
const TRAFFIT_CONTRACT = opts([
  "umowa cywilnoprawna (o dzieło lub zlecenie)",
  "umowa o pracę",
  "umowa o współpracy (B2B)",
]);
const TRAFFIT_SALARY = opts([
  "a) poniżej 8000 PLN",
  "b) 8500 - 10000 PLN",
  "e) 14500 - 16000 PLN",
  "g) 18500 - 20000 PLN",
  "h) 22500 - 24000 PLN",
  'n) powyżej 34000 PLN (prosimy o komentarz w "uwagach")',
]);

describe("classifyQuestion", () => {
  it.each([
    ["Poziom znajomości języka angielskiego", "language:en"],
    ["Poziom znajomości języka niemieckiego", "language:de"],
    ["English level", "language:en"],
    ["Znajomość języka angielskiego i niemieckiego", null],
    ["Dostępność", "availability"],
    ["Od kiedy możesz zacząć pracę?", "availability"],
    ["Możliwe formy współpracy", "contractTypes"],
    ["Model pracy (tryb pracy)", "workMode"],
    ["Oczekiwania finansowe (brutto UoP, netto B2B)", "salary"],
    ["Czy znasz Dockera i OpenShift?", null],
  ])("%s -> %s", (question, expected) => {
    expect(classifyQuestion(normalize(question))).toBe(expected);
  });
});

describe("chooseChoiceOptions", () => {
  it("prefers '1 miesiąc' over '30 dni' for one month", () => {
    expect(chooseChoiceOptions(rule("availability"), ["1m"], TRAFFIT_AVAILABILITY, false)).toEqual(["4"]);
  });

  it("matches the quoted 'od zaraz' option", () => {
    expect(chooseChoiceOptions(rule("availability"), ["immediately"], TRAFFIT_AVAILABILITY, false)).toEqual(["0"]);
  });

  it("skips hybrid when several hybrid options exist", () => {
    expect(chooseChoiceOptions(rule("workMode"), ["hybrid"], TRAFFIT_WORK_MODE, false)).toBeNull();
    expect(chooseChoiceOptions(rule("workMode"), ["remote"], TRAFFIT_WORK_MODE, false)).toEqual(["5"]);
  });

  it("selects every accepted contract in a multi-select", () => {
    expect(chooseChoiceOptions(rule("contractTypes"), ["uop", "b2b"], TRAFFIT_CONTRACT, true)).toEqual(["1", "2"]);
  });

  it("skips a single-select when several accepted contracts match", () => {
    expect(chooseChoiceOptions(rule("contractTypes"), ["uop", "b2b"], TRAFFIT_CONTRACT, false)).toBeNull();
    expect(chooseChoiceOptions(rule("contractTypes"), ["b2b"], TRAFFIT_CONTRACT, false)).toEqual(["2"]);
  });

  it("matches a language level by CEFR code", () => {
    expect(chooseChoiceOptions(LANGUAGE_LEVEL_RULE, ["C1"], opts(["A1", "A2", "B1", "B2", "C1", "C2"]), false)).toEqual(["4"]);
  });

  it("matches native speakers to a native option, or to C2 when there is none", () => {
    expect(chooseChoiceOptions(LANGUAGE_LEVEL_RULE, ["native"], opts(["B2", "C1", "Ojczysty"]), false)).toEqual(["2"]);
    expect(chooseChoiceOptions(LANGUAGE_LEVEL_RULE, ["native"], opts(["B2", "C1", "C2"]), false)).toEqual(["2"]);
  });

  it("returns null when the answer is not set", () => {
    expect(chooseChoiceOptions(LANGUAGE_LEVEL_RULE, [], opts(["C1"]), false)).toBeNull();
  });

  it("picks the one accepted work mode a single-choice form offers unambiguously", () => {
    expect(chooseChoiceOptions(rule("workMode"), ["hybrid", "remote"], TRAFFIT_WORK_MODE, false)).toEqual(["5"]);
    expect(chooseChoiceOptions(rule("workMode"), ["office", "remote"], TRAFFIT_WORK_MODE, false)).toBeNull();
    expect(chooseChoiceOptions(rule("workMode"), ["office", "remote"], TRAFFIT_WORK_MODE, true)).toEqual(["0", "5"]);
  });
});

describe("salary", () => {
  it("parses bucket texts", () => {
    expect(parseSalaryRange("b) 8500 - 10000 PLN")).toEqual({ min: 8500, max: 10000 });
    expect(parseSalaryRange("10 000 - 12 000 zł")).toEqual({ min: 10000, max: 12000 });
    expect(parseSalaryRange("a) poniżej 8000 PLN")).toEqual({ min: 0, max: 8000 });
    expect(parseSalaryRange("powyżej 34000 PLN")).toEqual({ min: 34000, max: Infinity });
    expect(parseSalaryRange("do uzgodnienia")).toBeNull();
  });

  it("picks the bucket containing the amount, and skips gaps", () => {
    expect(matchSalaryOption(15000, TRAFFIT_SALARY)?.text).toBe("e) 14500 - 16000 PLN");
    expect(matchSalaryOption(21000, TRAFFIT_SALARY)).toBeNull();
    expect(matchSalaryOption(40000, TRAFFIT_SALARY)?.value).toBe("5");
  });

  const row = (
    amount: string,
    contract: SalaryExpectation["contract"],
    period: SalaryExpectation["period"],
    basis: SalaryExpectation["basis"],
  ): SalaryExpectation => ({ amount, contract, period, basis });
  const rows = (...salaries: SalaryExpectation[]): Profile => ({ version: 1, values: {}, salaries });
  const pick = (question: string, p: Profile) => salaryFor(normalize(question), p)?.amount ?? null;

  it("picks the row matching the question's period, contract and net/gross", () => {
    const p = rows(
      row("95", "b2b", "hour", "net"),
      row("15000", "b2b", "month", "net"),
      row("14000", "uop", "month", "gross"),
    );
    expect(pick("Podaj oczekiwania finansowe B2B (zł/h netto)", p)).toBe("95");
    expect(pick("Wynagrodzenie brutto (UoP)", p)).toBe("14000");
    expect(pick("Expected salary, net B2B", p)).toBe("15000");
  });

  it("reads yearly questions and skips them without a yearly row", () => {
    expect(pick("Oczekiwane wynagrodzenie roczne brutto", rows(row("14000", "uop", "month", "gross")))).toBeNull();
    expect(pick("Expected annual salary (gross)", rows(row("180000", "uop", "year", "gross")))).toBe("180000");
  });

  it("uses the only fitting row when the question names both contracts", () => {
    const q = "Oczekiwania finansowe (brutto UoP, netto B2B)";
    expect(pick(q, rows(row("15000", "b2b", "month", "net")))).toBe("15000");
    expect(pick(q, rows(row("15000", "b2b", "month", "net"), row("14000", "uop", "month", "gross")))).toBeNull();
  });

  it("reads salaries saved by the previous version", () => {
    const legacy: Profile = { version: 1, values: { salaryHourlyNetB2b: "120" } };
    expect(pick("Stawka B2B netto zł/h", legacy)).toBe("120");
  });
});
