import { getText, type Profile } from "../shared/profile";
import type { SelectizeInfo } from "../shared/messages";
import type { FieldTarget, LocationFieldId } from "./adapters/types";
import { tagElement, type MainWorldBridge } from "./plan";
import { containsPhrase, normalize } from "./text";

type LocationOption = SelectizeInfo["options"][number];

type LocationTarget = Extract<FieldTarget, { kind: "location" }>;

const ORDER: LocationFieldId[] = ["country", "city"];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let regionCodes: string[] | null = null;

function allRegionCodes(): string[] {
  if (!regionCodes) {
    const english = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
    regionCodes = [...LETTERS]
      .flatMap((a) => [...LETTERS].map((b) => a + b))
      .filter((code) => english.of(code) && Intl.getCanonicalLocales(`und-${code}`)[0] === `und-${code}`);
  }
  return regionCodes;
}

function regionDisplays(languages: string[]): Intl.DisplayNames[] {
  return languages.flatMap((lang) => {
    try {
      return [new Intl.DisplayNames([lang], { type: "region", fallback: "none" })];
    } catch {
      return [];
    }
  });
}

export function countryCode(saved: string, languages: string[]): string | null {
  const q = normalize(saved);
  if (!q) return null;
  const displays = regionDisplays(languages);
  return (
    allRegionCodes().find(
      (code) => code.toLowerCase() === q || displays.some((d) => normalize(d.of(code) ?? "") === q),
    ) ?? null
  );
}

export function countryNames(saved: string, languages: string[]): string[] {
  const code = countryCode(saved, languages);
  const translated = code ? regionDisplays(languages).map((d) => d.of(code) ?? "") : [];
  return unique([saved, ...translated]);
}

function unique(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalize(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chooseLocation(names: string[], options: LocationOption[], country: string[] = []): LocationOption | null {
  const named = options.filter((o) => o.value !== "").map((o) => ({ option: o, text: normalize(o.text) }));
  const countries = country.map(normalize).filter(Boolean);

  for (const q of names.map(normalize).filter(Boolean)) {
    const exact = named.filter((n) => n.text === q);
    if (exact.length > 0) {
      const itself = exact.find((n) => n.option.details?.some((d) => normalize(d) === q));
      return (itself ?? exact[0]).option;
    }

    let hits = named.filter((n) => normalize(n.option.text.split(/[,(]/)[0]) === q);
    if (hits.length > 1 && countries.length > 0) {
      hits = hits.filter((n) => countries.some((c) => containsPhrase(n.text, c)));
    }
    if (hits.length === 1) return hits[0].option;
  }
  return null;
}

function pageLanguages(doc: Document): string[] {
  return unique([doc.documentElement.lang, "pl", "en"]);
}

export async function fillLocations(targets: FieldTarget[], profile: Profile, bridge: MainWorldBridge): Promise<number> {
  const locations = targets
    .filter((t): t is LocationTarget => t.kind === "location")
    .sort((a, b) => ORDER.indexOf(a.fieldId) - ORDER.indexOf(b.fieldId));
  if (locations.length === 0) return 0;

  const languages = pageLanguages(locations[0].element.ownerDocument);
  const savedCountry = getText(profile, "country");
  const country = countryNames(savedCountry, languages);
  const code = countryCode(savedCountry, languages)?.toLowerCase();

  let filled = 0;
  for (const t of locations) {
    const saved = getText(profile, t.fieldId);
    if (!saved) continue;
    const names = t.fieldId === "country" ? country : [saved];
    const tag = tagElement(t.element);

    for (const query of names) {
      const info = await bridge.searchSelectize(tag, query);
      if (!info || info.hasValue) break;
      const byCode = t.fieldId === "country" && code ? info.options.find((o) => o.value.toLowerCase() === code) : null;
      const option = byCode ?? chooseLocation(names, info.options, t.fieldId === "city" ? country : []);
      if (option) {
        filled += await bridge.setSelectize([{ target: tag, values: [option.value] }]);
        break;
      }
    }
  }
  return filled;
}
