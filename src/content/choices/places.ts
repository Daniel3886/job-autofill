import { FIELD_RULES } from "../fieldRules";
import { words } from "../locales";
import { containsPhrase, normalize } from "../text";
import type { ChoiceOption } from "./optionMatch";

const PLACE_FIELDS = ["region", "country"] as const;

const PREFIXES = words((l) => l.placePrefixes);

export function classifyPlaceQuestion(question: string): string | null {
  const hits = PLACE_FIELDS.filter((id) =>
    FIELD_RULES.find((r) => r.id === id)?.keywords.some((k) => containsPhrase(question, k)),
  );
  return hits.length === 1 ? hits[0] : null;
}

export function isPlaceField(fieldId: string): boolean {
  return (PLACE_FIELDS as readonly string[]).includes(fieldId);
}

function placeName(text: string): string {
  let name = normalize(text);
  for (const prefix of PREFIXES) {
    if (name.startsWith(`${prefix} `)) name = name.slice(prefix.length + 1);
  }
  return name;
}

export function matchPlaceOption(saved: string, options: ChoiceOption[], fieldId = "region"): ChoiceOption | null {
  const name = placeName(saved);
  if (!name) return null;
  const hits = options.filter((o) => placeName(o.text) === name);
  if (hits.length > 0 || fieldId !== "country") return hits.length === 1 ? hits[0] : null;

  // "Poland" saved, "Polska" on the form: the same country under another language's name.
  const code = countryCode(saved);
  if (!code) return null;
  const sameCountry = options.filter((o) => countryCode(o.text) === code);
  return sameCountry.length === 1 ? sameCountry[0] : null;
}

/** Languages whose country names are recognised, from the browser's own locale data. */
const COUNTRY_NAME_LOCALES = ["en", "pl", "de", "fr", "es", "it", "uk", "ru", "nl", "pt", "cs", "sv", "no"];

let countryIndex: Map<string, string> | undefined;

function countryNames(): Map<string, string> {
  if (countryIndex) return countryIndex;
  countryIndex = new Map();
  const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
  // Not countries: unknown region, EU, eurozone, UN, outlying Oceania, pseudo-locales.
  const notCountries = new Set(["ZZ", "EU", "EZ", "UN", "QO", "XA", "XB"]);
  const codes = letters.flatMap((a) => letters.map((b) => a + b)).filter((c) => !notCountries.has(c));
  // Retired codes name their successor ("DD" is "Germany"); map them onto it.
  const canonical = (code: string) => {
    try {
      return new Intl.Locale(`und-${code}`).region ?? code;
    } catch {
      return code;
    }
  };
  const ambiguous = new Set<string>();
  for (const locale of COUNTRY_NAME_LOCALES) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
    } catch {
      continue;
    }
    for (const code of codes) {
      const name = names.of(code);
      if (!name) continue;
      const key = placeName(name);
      const known = countryIndex.get(key);
      const current = canonical(code);
      if (known && known !== current) ambiguous.add(key);
      else countryIndex.set(key, current);
    }
  }
  for (const key of ambiguous) countryIndex.delete(key);
  return countryIndex;
}

/** ISO 3166 code of a country name in any of the supported languages, or null. */
export function countryCode(name: string): string | null {
  return countryNames().get(placeName(name)) ?? null;
}
