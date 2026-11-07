import { getText, type Profile } from "../shared/profile";
import type { FieldTarget, LocationFieldId } from "./adapters/types";
import type { SelectizeInfo } from "../shared/messages";
import { tagElement, type MainWorldBridge } from "./plan";
import { containsPhrase, normalize } from "./text";

type LocationOption = SelectizeInfo["options"][number];

type LocationTarget = Extract<FieldTarget, { kind: "location" }>;

const ORDER: LocationFieldId[] = ["country", "city"];

export function chooseLocation(query: string, options: LocationOption[], country = ""): LocationOption | null {
  const q = normalize(query);
  if (!q) return null;
  const named = options.filter((o) => o.value !== "").map((o) => ({ option: o, text: normalize(o.text) }));

  const exact = named.filter((n) => n.text === q);
  if (exact.length > 0) {
    const itself = exact.find((n) => n.option.details?.some((d) => normalize(d) === q));
    return (itself ?? exact[0]).option;
  }

  let hits = named.filter((n) => normalize(n.option.text.split(/[,(]/)[0]) === q);
  const c = normalize(country);
  if (hits.length > 1 && c) hits = hits.filter((n) => containsPhrase(n.text, c));
  return hits.length === 1 ? hits[0].option : null;
}

export async function fillLocations(targets: FieldTarget[], profile: Profile, bridge: MainWorldBridge): Promise<number> {
  const locations = targets
    .filter((t): t is LocationTarget => t.kind === "location")
    .sort((a, b) => ORDER.indexOf(a.fieldId) - ORDER.indexOf(b.fieldId));

  let filled = 0;
  for (const t of locations) {
    const query = getText(profile, t.fieldId);
    if (!query) continue;
    const tag = tagElement(t.element);
    const info = await bridge.searchSelectize(tag, query);
    if (!info || info.hasValue) continue;
    const country = t.fieldId === "city" ? getText(profile, "country") : "";
    const option = chooseLocation(query, info.options, country);
    if (option) filled += await bridge.setSelectize([{ target: tag, values: [option.value] }]);
  }
  return filled;
}
