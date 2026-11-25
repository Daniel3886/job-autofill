import { searchBoxSpec } from "../drivers/searchBox";
import { isFillableText } from "../drivers/text";
import { sleep } from "../drivers/combobox";
import { rawQuestionText } from "../signals";
import type { FieldTarget, VendorAdapter } from "./types";

/**
 * Lever (jobs.lever.co/<company>/<id>/apply). Its questions are labels that wrap their fields,
 * which the generic adapter reads. Only "Current location" needs this adapter: it is a search
 * box that keeps a value only when one of its results is picked.
 */
const PARSE_POLL_MS = 100;
const PARSE_WAIT_MS = 20000;

const isShown = (el: Element | null): boolean => el instanceof HTMLElement && getComputedStyle(el).display !== "none";

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

  /**
   * Attaching a CV makes Lever upload and parse it, then write the parsed company, location and
   * links into every field nobody has typed in. A location picked from its results counts as
   * untouched there, and its hidden JSON always does, so the location is filled after this.
   */
  async settleAfterCv(doc) {
    const working = doc.querySelector(".resume-upload-working");
    const deadline = Date.now() + PARSE_WAIT_MS;
    while (isShown(working) && Date.now() < deadline) await sleep(PARSE_POLL_MS);
    if (isShown(working)) console.warn("Job Autofill: Lever is still reading the CV after 20 s; filling the location anyway");
  },
  settleMessage: "Waiting for Lever to read your CV, so it does not overwrite the location afterwards.",
};
