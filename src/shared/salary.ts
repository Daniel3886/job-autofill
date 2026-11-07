import type { SalaryPeriod } from "./profile";

export const HOURS_PER_MONTH = 168;
export const MONTHS_PER_YEAR = 12;

const HOURS_IN: Record<SalaryPeriod, number> = {
  hour: 1,
  month: HOURS_PER_MONTH,
  year: HOURS_PER_MONTH * MONTHS_PER_YEAR,
};

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return cleaned !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export function convertAmount(amount: number, from: SalaryPeriod, to: SalaryPeriod): number {
  return (amount * HOURS_IN[to]) / HOURS_IN[from];
}

export function formatAmount(amount: number, period: SalaryPeriod): string {
  const rounded = period === "hour" ? Math.round(amount * 100) / 100 : Math.round(amount);
  return String(rounded);
}
