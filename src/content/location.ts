import { getText, type Profile } from "../shared/profile";
import type { SelectizeInfo } from "../shared/messages";
import type { FieldTarget } from "./adapters/types";
import { LOCALES } from "./locales";
import { tagElement, type MainWorldBridge } from "./plan";
import { normalize } from "./text";

type LocationOption = SelectizeInfo["options"][number];

type LocationTarget = Extract<FieldTarget, { kind: "location" }>;

export function cityNames(saved: string): string[] {
  const places = LOCALES.flatMap((l) => l.places ?? []);
  return unique(
    [saved, saved.split(/[,(]/)[0]].flatMap((name) => {
      const q = normalize(name);
      return [name.trim(), ...(places.find((names) => names.some((n) => normalize(n) === q)) ?? [])];
    }),
  );
}

function unique(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chooseLocation(names: string[], options: LocationOption[]): LocationOption | null {
  const named = options.filter((o) => o.value !== "").map((o) => ({ option: o, text: normalize(o.text) }));

  for (const q of names.map(normalize).filter(Boolean)) {
    const exact = named.filter((n) => n.text === q);
    if (exact.length > 0) {
      const itself = exact.find((n) => n.option.details?.some((d) => normalize(d) === q));
      return (itself ?? exact[0]).option;
    }

    const hits = named.filter((n) => normalize(n.option.text.split(/[,(]/)[0]) === q);
    if (hits.length === 1) return hits[0].option;
  }
  return named.length === 1 ? named[0].option : null;
}

export async function fillLocations(targets: FieldTarget[], profile: Profile, bridge: MainWorldBridge): Promise<number> {
  const saved = getText(profile, "city");
  if (!saved) return 0;

  let filled = 0;
  for (const t of targets.filter((target): target is LocationTarget => target.kind === "location")) {
    const names = cityNames(saved);
    const tag = tagElement(t.element);
    const seen: string[] = [];
    let skipped = "";

    for (const query of names) {
      const info = await bridge.searchSelectize(tag, query);
      if (!info) {
        skipped = "the dropdown could not be reached";
        break;
      }
      if (info.hasValue) {
        skipped = "the form already has a city";
        break;
      }
      seen.push(...info.options.map((o) => o.text));
      const option = chooseLocation(names, info.options);
      if (option) {
        filled += await bridge.setSelectize([{ target: tag, values: [option.value] }]);
        skipped = "";
        break;
      }
      skipped = seen.length > 0 ? `no result matched (got: ${[...new Set(seen)].join("; ")})` : "the search returned nothing";
    }
    if (skipped) console.info(`Job Autofill: city "${saved}" not filled: ${skipped}. Searched: ${names.join(", ")}`);
  }
  return filled;
}
