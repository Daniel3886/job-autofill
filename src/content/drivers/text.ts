import type { TextLike } from "../signals";

const FILLABLE_TYPES = new Set(["text", "email", "tel", "number", "search", ""]);

// Text inputs and textareas worth considering: enabled, editable, visible,
// and empty. Non-empty fields are skipped so a second click never overwrites
// what the user typed by hand.
export function isFillableText(el: TextLike, checkVisibility: boolean): boolean {
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (!FILLABLE_TYPES.has(type)) return false;
  }
  if (el.disabled || el.readOnly || el.value !== "") return false;
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

// React and Vue track a field's value themselves. Assigning el.value directly
// can go unnoticed, so the form submits empty. Calling the native setter and
// then firing the events real typing fires makes the framework pick it up.
export function setTextValue(el: TextLike, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  el.focus();
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
}
