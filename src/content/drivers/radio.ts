import { byIdNear, queryAllDeep } from "../dom";
import { findNearbyText } from "../signals";
import { normalize } from "../text";
import { isHiddenByMarkup, isHoneypot } from "../visibility";

export interface RadioGroup {
  name: string;
  radios: HTMLInputElement[];
  question: string;
}

export function collectRadioGroups(root: ParentNode, exclude: Set<Element> = new Set()): RadioGroup[] {
  const byName = new Map<string, HTMLInputElement[]>();
  for (const r of queryAllDeep<HTMLInputElement>(root, 'input[type="radio"]')) {
    // Styled radios hide the native input, so only markup and honeypot names rule one out.
    if (exclude.has(r) || !r.name || r.disabled || isHoneypot(r) || isHiddenByMarkup(r)) continue;
    const list = byName.get(r.name) ?? [];
    list.push(r);
    byName.set(r.name, list);
  }

  const groups: RadioGroup[] = [];
  for (const [name, radios] of byName) {
    if (radios.some((r) => r.checked)) continue;
    groups.push({ name, radios, question: groupQuestion(radios) });
  }
  return groups;
}

export function radioLabel(r: HTMLInputElement): string {
  const label = [...(r.labels ?? [])].map((l) => l.textContent ?? "").join(" ").trim();
  if (label) return label;
  return (r.nextSibling?.textContent ?? "").trim();
}

export function checkRadio(r: HTMLInputElement): void {
  r.click();
}

function groupQuestion(radios: HTMLInputElement[]): string {
  const container = commonAncestor(radios);
  if (!container) return "";

  const fieldset = container.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (fieldset && legend) {
    const names = new Set([...fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((r) => r.name));
    if (names.size === 1) return normalize(legend.textContent ?? "");
  }

  const group = container.closest('[role="radiogroup"]');
  if (group) {
    const aria = group.getAttribute("aria-label");
    if (aria) return normalize(aria);
    const by = group.getAttribute("aria-labelledby");
    if (by) return normalize(byIdNear(container, by)?.textContent ?? "");
  }

  return normalize(findNearbyText(container));
}

function commonAncestor(elements: HTMLElement[]): HTMLElement | null {
  let node = elements[0]?.parentElement ?? null;
  while (node && !elements.every((e) => node!.contains(e))) node = node.parentElement;
  return node;
}
