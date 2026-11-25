import { queryAllDeep } from "./dom";
import { collectComboboxes, isComboboxEmpty } from "./drivers/combobox";
import { isSelectized } from "./drivers/select";
import { hasTypedValue, isTextLike } from "./drivers/text";
import { cleanQuestion, findNearbyText, ownLabelText, rawQuestionText } from "./signals";
import { normalize } from "./text";
import { isHiddenByMarkup, isHoneypot, isPersonFacing } from "./visibility";

export interface Leftover {
  question: string;
  required: boolean;
}

const MAX_QUESTION = 120;
const OWN_HOST = '[id^="job-autofill"]';
const REQUIRED_MARK = /[*✱]\s*:?\s*$|^\s*[*✱]/;

/** Inside this extension's own panels (picker, report), also across shadow roots. */
function isOwn(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (node.closest(OWN_HOST)) return true;
    const root = node.getRootNode();
    node = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}

function shorten(text: string): string {
  const clean = cleanQuestion(text);
  return clean.length > MAX_QUESTION ? `${clean.slice(0, MAX_QUESTION - 1).trimEnd()}…` : clean;
}

function markedRequired(el: HTMLElement, raw: string): boolean {
  if ((el as HTMLInputElement).required || el.getAttribute("aria-required") === "true") return true;
  return REQUIRED_MARK.test(raw);
}

/** The question as the page shows it, keeping the "*" that cleanQuestion drops. */
function rawLabel(el: HTMLElement): string {
  const labels = [...((el as HTMLInputElement).labels ?? [])].map((l) => ownLabelText(l, el)).join(" ").trim();
  return (
    labels ||
    el.getAttribute("aria-label")?.trim() ||
    findNearbyText(el) ||
    el.getAttribute("placeholder")?.trim() ||
    ""
  );
}

function entry(el: HTMLElement, raw = rawLabel(el), question = raw || rawQuestionText(el)): Leftover | null {
  const text = shorten(question);
  return text ? { question: text, required: markedRequired(el, raw) } : null;
}

function commonAncestor(elements: HTMLElement[]): HTMLElement | null {
  let node = elements[0]?.parentElement ?? null;
  while (node && !elements.every((e) => node!.contains(e))) node = node.parentElement;
  return node;
}

function radioLeftovers(root: ParentNode): Leftover[] {
  const byName = new Map<string, HTMLInputElement[]>();
  for (const r of queryAllDeep<HTMLInputElement>(root, 'input[type="radio"]')) {
    if (!r.name || r.disabled || isHoneypot(r) || isHiddenByMarkup(r) || isOwn(r)) continue;
    byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  }
  const out: Leftover[] = [];
  for (const radios of byName.values()) {
    if (radios.some((r) => r.checked)) continue;
    const container = commonAncestor(radios);
    if (!container) continue;
    const legend = container.closest("fieldset")?.querySelector("legend")?.textContent?.trim() ?? "";
    const group = container.closest('[role="radiogroup"]')?.getAttribute("aria-label")?.trim() ?? "";
    const raw = legend || group || findNearbyText(container);
    const text = shorten(raw);
    if (text) out.push({ question: text, required: radios.some((r) => r.required) || REQUIRED_MARK.test(raw) });
  }
  return out;
}

function checkboxText(box: HTMLInputElement): string {
  const labels = [...(box.labels ?? [])].map((l) => ownLabelText(l, box)).join(" ").trim();
  if (labels) return labels;
  const row = box.parentElement;
  if (!row || row.querySelectorAll('input[type="checkbox"]').length > 1) return "";
  return ownLabelText(row).trim();
}

/**
 * Controls a person still has to fill after the extension ran: empty, visible, not a trap.
 * Optional checkboxes are not listed, since leaving one unticked is an answer. Required items
 * come first, and a question shown by several controls is listed once.
 */
export function findLeftovers(root: ParentNode, checkLayout: boolean): Leftover[] {
  const found: Leftover[] = [];
  const push = (item: Leftover | null) => {
    if (item) found.push(item);
  };

  for (const el of queryAllDeep<HTMLInputElement | HTMLTextAreaElement>(root, "input, textarea")) {
    if (isOwn(el) || el.getAttribute("role") === "combobox" || el.closest(".selectize-control")) continue;
    const isDate = el instanceof HTMLInputElement && el.type === "date";
    const empty = isDate ? el.value === "" && !el.disabled && !el.readOnly : isTextLike(el) && !hasTypedValue(el);
    if (empty && isPersonFacing(el, checkLayout)) push(entry(el));
  }

  for (const select of queryAllDeep<HTMLSelectElement>(root, "select")) {
    if (isOwn(select) || select.disabled) continue;
    const selectized = isSelectized(select);
    if (!isPersonFacing(select, checkLayout && !selectized)) continue;
    // A pre-selected real option is an answer the person can see; only "no choice" is left.
    const empty = selectized
      ? !select.parentElement?.querySelector(".selectize-control .item")
      : select.multiple
        ? select.selectedOptions.length === 0
        : (select.options[select.selectedIndex]?.value ?? "") === "";
    if (empty) push(entry(select));
  }

  found.push(...radioLeftovers(root));

  for (const box of collectComboboxes(root)) {
    if (!isOwn(box) && isPersonFacing(box, checkLayout) && isComboboxEmpty(box)) push(entry(box));
  }

  for (const box of queryAllDeep<HTMLInputElement>(root, 'input[type="checkbox"]')) {
    if (isOwn(box) || box.checked || box.disabled || isHoneypot(box) || isHiddenByMarkup(box)) continue;
    const raw = checkboxText(box);
    if (markedRequired(box, raw)) push(entry(box, raw));
  }

  for (const input of queryAllDeep<HTMLInputElement>(root, 'input[type="file"]')) {
    if (isOwn(input) || input.disabled || (input.files?.length ?? 0) > 0) continue;
    if (!isHoneypot(input) && !isHiddenByMarkup(input)) push(entry(input));
  }

  const byKey = new Map<string, Leftover>();
  for (const item of found) {
    const key = normalize(item.question);
    const known = byKey.get(key);
    if (known) known.required ||= item.required;
    else byKey.set(key, { ...item });
  }
  const list = [...byKey.values()];
  return [...list.filter((i) => i.required), ...list.filter((i) => !i.required)];
}
