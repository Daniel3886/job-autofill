import { countryCode } from "../choices/places";
import { chooseLocation, cityNames } from "../location";
import { normalize } from "../text";
import { press, sleep } from "./combobox";

/**
 * A search box that is a plain text input with its own result rows (no ARIA roles), such as
 * Lever's "Current location". The page searches on key presses and keeps only a value picked
 * from its rows; anything typed and left is cleared when the box loses focus.
 */
export interface SearchBoxSpec {
  /** Ancestor holding the box and its results. */
  scope: string;
  /** One result row. */
  option: string;
  /** The "nothing found" message, shown once a search has finished empty. */
  noResults?: string;
}

const POLL_MS = 25;
const SEARCH_WAIT_MS = 5000;

const LEVER_LOCATION: SearchBoxSpec = {
  scope: ".application-question",
  option: ".dropdown-location",
  noResults: ".dropdown-no-results",
};

/** The search box `el` is, if it is one this driver knows. */
export function searchBoxSpec(el: Element): SearchBoxSpec | null {
  if (el instanceof HTMLInputElement && el.matches("input.location-input") && el.closest(LEVER_LOCATION.scope)?.querySelector(".dropdown-results")) {
    return LEVER_LOCATION;
  }
  return null;
}

function setValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
}

function typeQuery(el: HTMLInputElement, query: string): void {
  el.focus();
  setValue(el, query);
  const key = query.slice(-1);
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, composed: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true, composed: true }));
}

const isShown = (el: Element | null | undefined): boolean =>
  !!el && el instanceof HTMLElement && getComputedStyle(el).display !== "none";

/** Rows for the query just typed. Rows or a "nothing found" message left from an earlier search do not count. */
async function waitForRows(scope: Element, spec: SearchBoxSpec): Promise<HTMLElement[]> {
  const stale = new Set(scope.querySelectorAll(spec.option));
  const noResults = spec.noResults ? scope.querySelector(spec.noResults) : null;
  let messageReset = !isShown(noResults);
  const deadline = Date.now() + SEARCH_WAIT_MS;
  for (;;) {
    await sleep(POLL_MS);
    const rows = [...scope.querySelectorAll<HTMLElement>(spec.option)];
    if (rows.some((r) => !stale.has(r))) return rows;
    if (!isShown(noResults)) messageReset = true;
    else if (messageReset) return [];
    if (Date.now() >= deadline) return [];
  }
}

/**
 * The row named like the place. Several places share a name ("Warsaw, Poland", "Warsaw,
 * Indiana"); then the saved country decides, and without one nothing is chosen.
 */
function chooseRow(names: string[], rows: HTMLElement[], country: string): HTMLElement | null {
  const options = rows.map((r, i) => ({ value: String(i), text: (r.textContent ?? "").trim() }));
  const single = chooseLocation(names, options, false);
  const wanted = new Set(names.map(normalize));
  const named = options.filter((o) => wanted.has(normalize(o.text.split(/[,(]/)[0])));
  if (named.length <= 1) return single ? rows[Number(single.value)] : null;
  const code = country ? countryCode(country) : null;
  if (!code) return null;
  const inCountry = named.filter((o) => o.text.split(",").slice(1).some((part) => countryCode(part) === code));
  return inCountry.length === 1 ? rows[Number(inCountry[0].value)] : null;
}

/**
 * Searches for `value` (and its other spellings) and picks the result named like it.
 * Returns "filled", or why the box was left empty.
 */
export async function fillSearchBox(el: HTMLInputElement, spec: SearchBoxSpec, value: string, country = ""): Promise<string> {
  const scope = el.closest(spec.scope) ?? el.ownerDocument.body;
  const names = cityNames(value);
  for (const query of names) {
    typeQuery(el, query);
    const rows = await waitForRows(scope, spec);
    const row = chooseRow(names, rows, country);
    if (row) {
      press(row);
      await sleep(POLL_MS);
      el.blur();
      return el.value.trim() ? "filled" : "the page did not take the result";
    }
  }
  setValue(el, "");
  el.blur();
  return `no result matched "${value}"`;
}
