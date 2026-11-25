import { words } from "./locales";
import { containsPhrase } from "./text";

export const START_DATE_KEYWORDS = words((l) => l.startDate);

/** A date format a box announces in its placeholder: "DD.MM.YYYY", "RRRR-MM-DD", "MM/DD/YYYY". */
const FORMAT = /^(?=.*(?:YYYY|RRRR))(?=.*MM)(?=.*DD)(?:YYYY|RRRR|MM|DD|[./\-\s])+$/;

export function dateFormat(placeholder: string): string | null {
  const text = placeholder.trim().toUpperCase();
  return FORMAT.test(text) ? text : null;
}

export function isStartDateQuestion(question: string): boolean {
  return START_DATE_KEYWORDS.some((k) => containsPhrase(question, k));
}

/** The earliest start date for a saved availability ("2w"), or null when it says nothing about time. */
export function startDate(availability: string, today: Date): Date | null {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const m = /^(\d+)([wm])$/.exec(availability);
  if (availability === "immediately") return date;
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === "w") date.setDate(date.getDate() + 7 * n);
  else {
    const day = date.getDate();
    date.setMonth(date.getMonth() + n, 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  }
  return date;
}

export function formatDate(date: Date, format: string): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return format
    .replace(/YYYY|RRRR/, String(date.getFullYear()))
    .replace("MM", two(date.getMonth() + 1))
    .replace("DD", two(date.getDate()));
}
