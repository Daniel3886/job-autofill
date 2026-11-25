import { searchBoxSpec } from "../drivers/searchBox";
import { isFillableText } from "../drivers/text";
import { rawQuestionText } from "../signals";
import type { FieldTarget, VendorAdapter } from "./types";

/**
 * Lever (jobs.lever.co/<company>/<id>/apply). Its questions are labels that wrap their fields,
 * which the generic adapter reads. Only "Current location" needs this adapter: it is a search
 * box that keeps a value only when one of its results is picked.
 */
export const leverAdapter: VendorAdapter = {
  id: "lever",

  detect(doc) {
    return doc.querySelector("#application-form .application-question input.location-input") !== null;
  },

  collect(doc, ctx) {
    const targets: FieldTarget[] = [];
    for (const element of doc.querySelectorAll<HTMLInputElement>("#application-form input.location-input")) {
      const spec = searchBoxSpec(element);
      if (!spec || ctx.claimed.has(element)) continue;
      ctx.claimed.add(element);
      ctx.claimedFields.add("city");
      if (isFillableText(element, ctx.checkVisibility)) {
        targets.push({ kind: "search", fieldId: "city", question: rawQuestionText(element), element, spec });
      }
    }
    return targets;
  },
};
