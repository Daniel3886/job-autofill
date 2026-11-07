import { normalize } from "../text";
import en from "./en.json";
import pl from "./pl.json";

export interface Locale {
  fields?: Record<string, { labels?: string[]; attributes?: string[] }>;
  questions?: Record<string, string[]>;
  options?: Record<string, Record<string, string[][]>>;
  languages?: Record<string, string[]>;
  levels?: Record<string, string[]>;
  salary?: Record<string, string[]>;
  salaryRanges?: { below?: string[]; above?: string[] };
  cv?: { keywords?: string[]; otherDocuments?: string[] };
  places?: string[][];
  placePrefixes?: string[];
}

export const LOCALES: Locale[] = [en, pl];

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

export function words(pick: (locale: Locale) => string[] | undefined, locales: Locale[] = LOCALES): string[] {
  return unique(locales.flatMap((l) => pick(l) ?? []).map(normalize).filter(Boolean));
}

export function tiers(pick: (locale: Locale) => string[][] | undefined, locales: Locale[] = LOCALES): string[][] {
  const merged: string[][] = [];
  for (const locale of locales) {
    (pick(locale) ?? []).forEach((tier, i) => {
      merged[i] = [...(merged[i] ?? []), ...tier.map(normalize).filter(Boolean)];
    });
  }
  return merged.map(unique);
}
