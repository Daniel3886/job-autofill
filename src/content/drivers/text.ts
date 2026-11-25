import { queryAllDeep } from "../dom";
import type { TextLike } from "../signals";
import { isPersonFacing } from "../visibility";

const FILLABLE_TYPES = new Set(["text", "email", "tel", "url", "number", "search", ""]);

export function isTextLike(el: unknown): el is TextLike {
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  return FILLABLE_TYPES.has(type) && !el.disabled && !el.readOnly;
}

/** Only an input mask's blanks: "(___) ___-____", "__.__.____". */
const MASK_ONLY = /^[\s_\-()./#*]*$/;
/** A phone mask that shows just its fixed dialling code: "+48 ", "+48 ___ ___ ___". */
const DIAL_CODE_ONLY = /^\s*\+\d{1,3}[\s_\-()]*$/;

function isPhoneBox(el: TextLike): boolean {
  if (el.getAttribute("type") === "tel") return true;
  return /phone|tel|mobile|telefon/i.test(`${el.getAttribute("name") ?? ""} ${el.id}`);
}

/**
 * Does the input hold something a person typed? A masked input shows its blanks (and a phone
 * mask its dialling code) before anything is typed; that is not a value.
 */
export function hasTypedValue(el: TextLike): boolean {
  const value = el.value;
  if (value === "" || (MASK_ONLY.test(value) && /[_#*]/.test(value))) return false;
  return !(isPhoneBox(el) && DIAL_CODE_ONLY.test(value));
}

export function isFillableText(el: TextLike, checkVisibility: boolean): boolean {
  if (!isTextLike(el) || hasTypedValue(el)) return false;
  return isPersonFacing(el, checkVisibility);
}

export function collectTextInputs(
  root: ParentNode,
  checkVisibility = true,
  exclude: Set<Element> = new Set(),
): TextLike[] {
  return queryAllDeep<TextLike>(root, "input, textarea").filter(
    (el) =>
      !exclude.has(el) &&
      !el.closest(".selectize-control") &&
      el.getAttribute("role") !== "combobox" &&
      isFillableText(el, checkVisibility),
  );
}

export function setTextValue(el: TextLike, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  el.focus();
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  el.blur();
}
