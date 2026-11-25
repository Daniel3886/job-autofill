import { normalize } from "./text";

/**
 * Anti-bot traps: inputs a person never sees, placed next to the real ones. Writing into one
 * loses the answer or marks the application as spam.
 */
const HONEYPOT_ATTR = /(^| )fake|honey ?pot|bot ?trap|hpcsaf|^nickname /;
const HONEYPOT_LABEL = ["leave this field blank", "leave this field empty", "do not fill", "zostaw puste", "nie wypelniaj"];

/** Parent of a node, stepping out of a shadow root to its host. */
export function parentOf(node: Element): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

export function isHoneypot(el: HTMLElement): boolean {
  const attrs = normalize(`${el.getAttribute("name") ?? ""} ${el.id}`);
  if (HONEYPOT_ATTR.test(attrs)) return true;
  const around = normalize(
    `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("placeholder") ?? ""} ${[...((el as HTMLInputElement).labels ?? [])].map((l) => l.textContent).join(" ")}`,
  );
  return HONEYPOT_LABEL.some((phrase) => ` ${around} `.includes(` ${phrase} `));
}

/** Hidden by markup alone (`hidden`, `aria-hidden`, `inert` on it or an ancestor). Needs no layout. */
export function isHiddenByMarkup(el: Element): boolean {
  for (let node: Element | null = el; node; node = parentOf(node)) {
    if (node instanceof HTMLElement && node.hidden) return true;
    if (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("inert")) return true;
  }
  return false;
}

/** Laid out, but where a person cannot see it: no box, display/visibility off, or pushed off the page. */
export function isHiddenByLayout(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return true;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return true;
  const rect = el.getBoundingClientRect();
  const view = el.ownerDocument.defaultView;
  const left = rect.right + (view?.scrollX ?? 0);
  const top = rect.bottom + (view?.scrollY ?? 0);
  return left <= 0 || top <= 0;
}

/**
 * Would a person see and fill this control? Honeypots and markup-hidden controls are always
 * skipped; the layout test runs only when the caller has layout (`checkLayout`).
 */
export function isPersonFacing(el: HTMLElement, checkLayout: boolean): boolean {
  if (isHoneypot(el) || isHiddenByMarkup(el)) return false;
  return !checkLayout || !isHiddenByLayout(el);
}
