import { normalize } from "./text";

// Everything an <input> tells us about what it is for, already normalised.
export interface InputSignals {
  autocomplete: string[]; // raw tokens, e.g. ["section-a", "given-name"]
  type: string;
  label: string; // <label for>, wrapping <label>, aria-labelledby
  ariaLabel: string;
  attrs: string; // name + id
  placeholder: string;
  nearbyText: string; // fallback: short text just before the input
}

export function readSignals(el: HTMLInputElement): InputSignals {
  const labelTexts = [...(el.labels ?? [])].map((l) => l.textContent ?? "");
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      labelTexts.push(el.ownerDocument.getElementById(id)?.textContent ?? "");
    }
  }
  const label = normalize(labelTexts.join(" "));

  return {
    autocomplete: (el.getAttribute("autocomplete") ?? "").toLowerCase().split(/\s+/).filter(Boolean),
    type: (el.getAttribute("type") ?? "text").toLowerCase(),
    label,
    ariaLabel: normalize(el.getAttribute("aria-label") ?? ""),
    attrs: normalize(`${el.name} ${el.id}`),
    placeholder: normalize(el.placeholder ?? ""),
    // Only look around the input when it has no proper label: the text is a guess.
    nearbyText: label ? "" : normalize(findNearbyText(el)),
  };
}

const MAX_NEARBY_TEXT = 80;

// Walks up a few levels and takes the closest preceding sibling with short text,
// e.g. <div><span>Imię</span><div><input></div></div>.
function findNearbyText(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  for (let depth = 0; depth < 3 && node; depth++) {
    const sibling: Element | null = node.previousElementSibling;
    if (sibling && !sibling.querySelector("input, select, textarea")) {
      const text = (sibling.textContent ?? "").trim();
      if (text && text.length <= MAX_NEARBY_TEXT) return text;
    }
    node = node.parentElement;
  }
  return "";
}
