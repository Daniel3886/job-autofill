import { normalize } from "./text";

export type TextLike = HTMLInputElement | HTMLTextAreaElement;

export interface InputSignals {
  autocomplete: string[];
  type: string;
  label: string;
  ariaLabel: string;
  attrs: string;
  placeholder: string;
  nearbyText: string;
}

export function readSignals(el: TextLike): InputSignals {
  const label = labelText(el);
  return {
    autocomplete: (el.getAttribute("autocomplete") ?? "").toLowerCase().split(/\s+/).filter(Boolean),
    type: el instanceof HTMLTextAreaElement ? "textarea" : (el.getAttribute("type") ?? "text").toLowerCase(),
    label,
    ariaLabel: normalize(el.getAttribute("aria-label") ?? ""),
    attrs: normalize(`${el.name} ${el.id}`),
    placeholder: normalize(el.placeholder ?? ""),
    nearbyText: label ? "" : normalize(findNearbyText(el)),
  };
}

export function signalsQuestion(s: InputSignals): string {
  return [s.label, s.ariaLabel, s.placeholder, s.nearbyText].filter(Boolean).join(" ");
}

export function questionText(el: HTMLSelectElement | HTMLElement): string {
  const label = labelText(el);
  if (label) return label;
  const aria = normalize(el.getAttribute("aria-label") ?? "");
  if (aria) return aria;
  return normalize(findNearbyText(el));
}

function labelText(el: HTMLElement): string {
  const labels = (el as HTMLInputElement).labels;
  const texts = [...(labels ?? [])].map((l) => l.textContent ?? "");
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      texts.push(el.ownerDocument.getElementById(id)?.textContent ?? "");
    }
  }
  return normalize(texts.join(" "));
}

const MAX_NEARBY_TEXT = 120;
const CONTROLS = "input, select, textarea";

export function findNearbyText(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  for (let depth = 0; depth < 3 && node; depth++) {
    let sibling: Element | null = node.previousElementSibling;
    while (sibling) {
      if (sibling.matches(CONTROLS) || sibling.querySelector(CONTROLS)) break;
      const text = (sibling.textContent ?? "").trim();
      if (normalize(text)) {
        if (text.length <= MAX_NEARBY_TEXT) return text;
        break;
      }
      sibling = sibling.previousElementSibling;
    }
    node = node.parentElement;
  }
  return "";
}

export function cleanQuestion(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[\s*:]+$/, "").trim();
}

export function rawQuestionText(el: HTMLElement): string {
  const labels = [...((el as HTMLInputElement).labels ?? [])].map((l) => l.textContent ?? "");
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) labels.push(el.ownerDocument.getElementById(id)?.textContent ?? "");
  }
  const text =
    labels.join(" ").trim() ||
    (el.getAttribute("aria-label") ?? "").trim() ||
    findNearbyText(el) ||
    (el.getAttribute("placeholder") ?? "").trim();
  return cleanQuestion(text);
}
