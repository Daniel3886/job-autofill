import { getText, type Profile } from "../shared/profile";
import type { FieldTarget } from "./adapters/types";
import { fillSearchBox } from "./drivers/searchBox";

/**
 * Fills search boxes one at a time. The value is the profile's city, or a saved answer for the
 * box's question when the profile has none: a field still resolves to one value.
 */
export async function fillSearchBoxes(targets: FieldTarget[], profile: Profile): Promise<number> {
  let filled = 0;
  for (const t of targets) {
    if (t.kind !== "search") continue;
    const saved = targets.find((a) => a.kind === "answer" && a.element === t.element);
    const value = getText(profile, t.fieldId) || (saved?.kind === "answer" ? saved.value.trim() : "");
    if (!value) continue;
    try {
      const outcome = await fillSearchBox(t.element, t.spec, value, getText(profile, "country"));
      if (outcome === "filled") filled++;
      else console.info(`Job Autofill: "${t.question}" not filled: ${outcome}`);
    } catch (err) {
      console.warn(`Job Autofill: search box "${t.question}" failed`, err);
    }
  }
  return filled;
}
