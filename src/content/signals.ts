import { normalize } from "./text";

export type TextLike = HTMLInputElement | HTMLTextAreaElement;

// Everything a text input tells us about what it is for, already normalised.
export interface InputSignals {
  autocomplete: string[]; // raw tokens, e.g. ["section-a", "given-name"]
  type: string;
  label: string; // <label for>, wrapping <label>, aria-labelledby
  ariaLabel: string;
  attrs: string; // name + id
  placeholder: string;
  nearbyText: string; // fallback: short text just before the input
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
    // Only look around the input when it has no proper label: the text is a guess.
    nearbyText: label ? "" : normalize(findNearbyText(el)),
  };
}

// All human-readable question text for one signal set, for question-type rules.
export function signalsQuestion(s: InputSignals): string {
  return [s.label, s.ariaLabel, s.placeholder, s.nearbyText].filter(Boolean).join(" ");
}

// Question text for a <select> or any other labelable control.
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

// Walks up a few levels and takes the closest preceding sibling with real text,
// e.g. <div><span>Imię</span><div><input></div></div>. Skips decorations like
// a lone "*", and stops at a sibling that holds another control, because its
// text belongs to a different field.
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
