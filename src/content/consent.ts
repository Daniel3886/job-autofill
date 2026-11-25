import { queryAllDeep } from "./dom";
import { words } from "./locales";
import { ownLabelText } from "./signals";
import { containsPhrase, normalize } from "./text";
import { isHiddenByMarkup, isHoneypot } from "./visibility";

const DATA_PROCESSING = words((l) => l.consent?.dataProcessing);
const REQUIRED_WORDS = words((l) => l.consent?.required);
const NEVER = words((l) => l.consent?.never);
const MAX_CONSENT_TEXT = 1500;

/** The text a checkbox stands for: its label, or the row it sits in. */
function consentText(box: HTMLInputElement): string {
  const labels = [...(box.labels ?? [])].map((l) => ownLabelText(l, box)).join(" ").trim();
  if (labels) return labels;
  const aria = box.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  // The row's text belongs to this box only when no other box shares the row.
  const row = box.parentElement;
  if (!row || row.querySelectorAll('input[type="checkbox"]').length > 1) return "";
  const text = ownLabelText(row).trim();
  return text.length <= MAX_CONSENT_TEXT ? text : "";
}

function isRequired(box: HTMLInputElement, raw: string): boolean {
  if (box.required || box.getAttribute("aria-required") === "true") return true;
  if (/\*\s*$|^\s*\*/.test(raw)) return true;
  const text = normalize(raw);
  return REQUIRED_WORDS.some((w) => containsPhrase(text, w));
}

/**
 * A required consent to processing personal data for this application. Optional boxes, and any
 * box that also mentions future recruitment, talent pools, marketing or newsletters, never count.
 */
export function isRequiredDataConsent(box: HTMLInputElement): boolean {
  const raw = consentText(box);
  const text = normalize(raw);
  if (!text || NEVER.some((w) => containsPhrase(text, w))) return false;
  return DATA_PROCESSING.some((w) => containsPhrase(text, w)) && isRequired(box, raw);
}

export function collectConsentBoxes(root: ParentNode, claimed: Set<Element>): HTMLInputElement[] {
  return queryAllDeep<HTMLInputElement>(root, 'input[type="checkbox"]').filter(
    (box) =>
      !claimed.has(box) &&
      !box.checked &&
      !box.disabled &&
      !isHoneypot(box) &&
      !isHiddenByMarkup(box) &&
      isRequiredDataConsent(box),
  );
}
