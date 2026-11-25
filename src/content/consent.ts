import { queryAllDeep } from "./dom";
import { words } from "./locales";
import { ownLabelText } from "./signals";
import { containsPhrase, normalize } from "./text";
import { isHiddenByMarkup, isHoneypot, parentOf } from "./visibility";

const DATA_PROCESSING = words((l) => l.consent?.dataProcessing);
const TERMS = words((l) => l.consent?.terms);
const CAPTCHA = /captcha|turnstile/i;
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

/** Inside a captcha widget (reCAPTCHA, hCaptcha, Turnstile): never the extension's to tick. */
function isInCaptcha(box: HTMLInputElement): boolean {
  for (let node: Element | null = box; node; node = parentOf(node)) {
    const marks = `${node.id} ${node.getAttribute("class") ?? ""} ${node.getAttribute("title") ?? ""}`;
    if (CAPTCHA.test(marks)) return true;
  }
  return false;
}

/**
 * A required box that agrees to this application's paperwork: processing personal data, the
 * privacy policy, or the terms ("regulamin"). Optional boxes, and any box that also mentions
 * future recruitment, talent pools, marketing, newsletters or partners, never count. Boxes inside
 * iframes are never reached, since the scan does not enter them.
 */
export function isRequiredConsentOrTerms(box: HTMLInputElement): boolean {
  if (isInCaptcha(box)) return false;
  const raw = consentText(box);
  const text = normalize(raw);
  if (!text || NEVER.some((w) => containsPhrase(text, w))) return false;
  const topic = [...DATA_PROCESSING, ...TERMS].some((w) => containsPhrase(text, w));
  return topic && isRequired(box, raw);
}

export function collectConsentBoxes(root: ParentNode, claimed: Set<Element>): HTMLInputElement[] {
  return queryAllDeep<HTMLInputElement>(root, 'input[type="checkbox"]').filter(
    (box) =>
      !claimed.has(box) &&
      !box.checked &&
      !box.disabled &&
      !isHoneypot(box) &&
      !isHiddenByMarkup(box) &&
      isRequiredConsentOrTerms(box),
  );
}
