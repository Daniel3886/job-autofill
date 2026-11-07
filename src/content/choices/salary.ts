import { getList, getText, type Profile, type SalaryFieldId } from "../../shared/profile";
import { words } from "../locales";
import { containsPhrase, normalize } from "../text";
import type { ChoiceOption } from "./optionMatch";

const HOURLY = words((l) => l.salary?.hourly);
const B2B = words((l) => l.salary?.b2b);
const UOP = words((l) => l.salary?.uop);

export function salaryFieldFor(question: string, profile: Profile): SalaryFieldId | null {
  const has = (words: string[]) => words.some((w) => containsPhrase(question, w));
  if (has(HOURLY)) return "salaryHourlyNetB2b";

  const b2b = has(B2B);
  const uop = has(UOP);
  if (b2b && !uop) return "salaryMonthlyNetB2b";
  if (uop && !b2b) return "salaryMonthlyGrossUop";

  const contracts = getList(profile, "contractTypes");
  if (contracts.length === 1 && contracts[0] === "b2b") return "salaryMonthlyNetB2b";
  if (contracts.length === 1 && contracts[0] === "uop") return "salaryMonthlyGrossUop";
  return null;
}

export function salaryText(question: string, profile: Profile): string {
  const field = salaryFieldFor(question, profile);
  return field ? getText(profile, field) : "";
}

export function salaryAmount(question: string, profile: Profile): number | null {
  const raw = salaryText(question, profile).replace(/[\s,]/g, "");
  const n = Number(raw);
  return raw !== "" && Number.isFinite(n) && n > 0 ? n : null;
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
