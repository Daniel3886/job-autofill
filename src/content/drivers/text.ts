import type { TextLike } from "../signals";

const FILLABLE_TYPES = new Set(["text", "email", "tel", "url", "number", "search", ""]);

export function isTextLike(el: unknown): el is TextLike {
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  return FILLABLE_TYPES.has(type) && !el.disabled && !el.readOnly;
}

export function isFillableText(el: TextLike, checkVisibility: boolean): boolean {
  if (!isTextLike(el) || el.value !== "") return false;
  return !checkVisibility || isVisible(el);
}

export function collectTextInputs(
  root: ParentNode,
  checkVisibility = true,
  exclude: Set<Element> = new Set(),
): TextLike[] {
  return [...root.querySelectorAll<TextLike>("input, textarea")].filter(
    (el) => !exclude.has(el) && isFillableText(el, checkVisibility),
  );
}

export function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

export function setTextValue(el: TextLike, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  el.focus();
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
}
