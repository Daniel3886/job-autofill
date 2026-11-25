import { byIdNear, queryAllDeep } from "../dom";
import { normalize } from "../text";
import { isHiddenByMarkup } from "../visibility";

/**
 * Dropdowns that are not a native <select> but follow the ARIA combobox pattern: react-select,
 * Radix/shadcn Select, Angular Material and most location autocompletes. Assigning a value does
 * nothing on these, so the driver does what a person does: open the list, read its
 * role="option" rows, click one.
 */
const POLL_MS = 25;
const OPEN_WAIT_MS = 700;
const SEARCH_WAIT_MS = 3000;
const PLACEHOLDER = /^(select|choose|wybierz|please select|--|-)/;

export interface ComboOption {
  element: HTMLElement;
  text: string;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A combobox control: role="combobox", or a button that opens a listbox. Selectize is handled elsewhere. */
export function isCombobox(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el instanceof HTMLSelectElement) return false;
  if (el.closest(".selectize-control")) return false;
  if (el.getAttribute("role") === "combobox") return true;
  return el instanceof HTMLButtonElement && el.getAttribute("aria-haspopup") === "listbox";
}

export function collectComboboxes(root: ParentNode): HTMLElement[] {
  return queryAllDeep<HTMLElement>(root, '[role="combobox"], button[aria-haspopup="listbox"]').filter(
    (el) => isCombobox(el) && !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true",
  );
}

/** The widget around the control: where react-select shows the chosen value. */
function container(el: HTMLElement): HTMLElement {
  let node: HTMLElement = el;
  for (let depth = 0; depth < 4 && node.parentElement; depth++) {
    node = node.parentElement;
    if (/container|select|combobox|dropdown/i.test(node.className)) return node;
  }
  return el.parentElement ?? el;
}

/**
 * Nothing chosen yet. Unsure counts as chosen, so a value someone picked is never replaced.
 */
export function isComboboxEmpty(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.value.trim() !== "") return false;
    return !container(el).querySelector('[class*="single-value"], [class*="singleValue"], [class*="multi-value"], [class*="multiValue"]');
  }
  if (el.hasAttribute("data-placeholder") || el.querySelector("[data-placeholder]")) return true;
  const text = normalize(el.textContent ?? "");
  return text === "" || PLACEHOLDER.test(text);
}

function listFor(el: HTMLElement): HTMLElement | null {
  for (const attr of ["aria-controls", "aria-owns"]) {
    const id = el.getAttribute(attr);
    const list = id ? byIdNear(el, id) ?? el.ownerDocument.getElementById(id) : null;
    if (list) return list;
  }
  return null;
}

function readOptions(el: HTMLElement): ComboOption[] {
  const list = listFor(el);
  const scope: ParentNode = list ?? el.ownerDocument;
  return queryAllDeep<HTMLElement>(scope, '[role="option"]')
    .filter((o) => o.getAttribute("aria-disabled") !== "true" && !isHiddenByMarkup(o))
    .map((o) => ({ element: o, text: (o.textContent ?? "").trim() }))
    .filter((o) => o.text !== "");
}

function fire(el: HTMLElement, type: string, init: MouseEventInit = {}): void {
  const opts = { bubbles: true, cancelable: true, composed: true, button: 0, ...init };
  const Ctor = type.startsWith("pointer") && typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent;
  el.dispatchEvent(new Ctor(type, opts));
}

export function press(el: HTMLElement): void {
  fire(el, "pointerdown");
  fire(el, "mousedown");
  fire(el, "pointerup");
  fire(el, "mouseup");
  fire(el, "click");
}

function key(el: HTMLElement, k: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, composed: true }));
}

async function waitForOptions(el: HTMLElement, ms: number, ready = (o: ComboOption[]) => o.length > 0) {
  const deadline = Date.now() + ms;
  for (;;) {
    const options = readOptions(el);
    if (ready(options) || Date.now() >= deadline) return options;
    await sleep(POLL_MS);
  }
}

function isOpen(el: HTMLElement): boolean {
  return el.getAttribute("aria-expanded") === "true" || readOptions(el).length > 0;
}

/** Opens the list and returns its rows, or [] when it shows none. */
export async function openOptions(el: HTMLElement): Promise<ComboOption[]> {
  el.focus();
  press(el);
  let options = await waitForOptions(el, OPEN_WAIT_MS);
  if (options.length === 0) {
    key(el, "ArrowDown");
    options = await waitForOptions(el, OPEN_WAIT_MS);
  }
  return options;
}

/** Types a search into an autocomplete and returns the rows it shows for it. */
export async function searchOptions(el: HTMLInputElement, query: string): Promise<ComboOption[]> {
  el.focus();
  press(el);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, query);
  el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  const before = new Set(readOptions(el).map((o) => o.element));
  // Wait for rows that answer this query, not the list shown before typing.
  return waitForOptions(el, SEARCH_WAIT_MS, (o) => o.some((x) => !before.has(x.element)));
}

export async function pickOption(option: ComboOption): Promise<void> {
  option.element.scrollIntoView?.({ block: "nearest" });
  press(option.element);
  await sleep(POLL_MS);
}

/** Closes a list left open without choosing anything; `typed` clears the search this driver typed. */
export async function closeList(el: HTMLElement, typed = false): Promise<void> {
  if (typed && el instanceof HTMLInputElement && el.value !== "") {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }
  if (isOpen(el)) key(el, "Escape");
  el.blur();
  await sleep(POLL_MS);
}
