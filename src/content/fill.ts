const FILLABLE_TYPES = new Set(["text", "email", "tel", "number", "search", ""]);

// Inputs worth considering: text-like, enabled, editable, visible, and empty.
// Non-empty inputs are skipped so a second click never overwrites what the
// user typed by hand.
export function collectFillableInputs(root: ParentNode, checkVisibility = true): HTMLInputElement[] {
  return [...root.querySelectorAll("input")].filter((el) => {
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (!FILLABLE_TYPES.has(type)) return false;
    if (el.disabled || el.readOnly || el.value !== "") return false;
    return !checkVisibility || isVisible(el);
  });
}

function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

// React and Vue track an input's value themselves. Assigning el.value directly
// can go unnoticed, so the form submits empty. Calling the native setter and
// then firing the events real typing fires makes the framework pick it up.
const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

export function setInputValue(el: HTMLInputElement, value: string): void {
  el.focus();
  nativeValueSetter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
}
