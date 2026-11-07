import { getSalaries, type Profile, type SalaryContract, type SalaryExpectation, type SalaryPeriod } from "../../shared/profile";
import { parseAmount } from "../../shared/salary";
import { words } from "../locales";
import { containsPhrase, normalize } from "../text";
import type { ChoiceOption } from "./optionMatch";

const HOURLY = words((l) => l.salary?.hourly);
const YEARLY = words((l) => l.salary?.yearly);
const CONTRACT_WORDS: Record<SalaryContract, string[]> = {
  b2b: words((l) => l.salary?.b2b),
  uop: words((l) => l.salary?.uop),
  civil: words((l) => l.salary?.civil),
};
const NET = words((l) => l.salary?.net);
const GROSS = words((l) => l.salary?.gross);

export function questionPeriod(question: string): SalaryPeriod {
  if (HOURLY.some((w) => containsPhrase(question, w))) return "hour";
  if (YEARLY.some((w) => containsPhrase(question, w))) return "year";
  return "month";
}

export function salaryFor(question: string, profile: Profile): SalaryExpectation | null {
  const has = (words: string[]) => words.some((w) => containsPhrase(question, w));
  const period = questionPeriod(question);
  const contracts = (Object.keys(CONTRACT_WORDS) as SalaryContract[]).filter((c) => has(CONTRACT_WORDS[c]));
  const net = has(NET);
  const gross = has(GROSS);

  const candidates = getSalaries(profile).filter(
    (s) =>
      parseAmount(s.amount) !== null &&
      s.period === period &&
      (contracts.length === 0 || contracts.includes(s.contract)) &&
      (net === gross || s.basis === (net ? "net" : "gross")),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function salaryText(question: string, profile: Profile): string {
  return salaryFor(question, profile)?.amount.trim() ?? "";
}

export function salaryAmount(question: string, profile: Profile): number | null {
  const salary = salaryFor(question, profile);
  return salary ? parseAmount(salary.amount) : null;
}

export interface SalaryRange {
  min: number;
  max: number;
}

const BELOW = words((l) => l.salaryRanges?.below);
const ABOVE = words((l) => l.salaryRanges?.above);

export function parseSalaryRange(text: string): SalaryRange | null {
  const raw = text.replace(/^\s*[a-z]\)\s*/i, "");
  const nums = [...raw.matchAll(/\d[\d\s.]*\d|\d/g)].map((m) => Number(m[0].replace(/[\s.]/g, "")));
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  if (nums.length === 1) {
    const words = normalize(raw);
    if (BELOW.some((w) => containsPhrase(words, w))) return { min: 0, max: nums[0] };
    if (ABOVE.some((w) => containsPhrase(words, w))) return { min: nums[0], max: Infinity };
  }
  return null;
}

export function matchSalaryOption(amount: number, options: ChoiceOption[]): ChoiceOption | null {
  const hits = options.filter((o) => {
    const r = parseSalaryRange(o.text);
    return r !== null && amount >= r.min && amount <= r.max;
  });
  return hits.length === 1 ? hits[0] : null;
}
