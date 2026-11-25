import { getText, type Profile } from "../shared/profile";
import type { FieldTarget } from "./adapters/types";
import {
  closeList,
  isComboboxEmpty,
  openOptions,
  pickOption,
  searchOptions,
  type ComboOption,
} from "./drivers/combobox";
import { chooseLocation, cityNames } from "./location";
import { choose } from "./plan";
import { byIdNear } from "./dom";
import { chooseByText } from "./choiceControls";

type ComboboxTarget = Extract<FieldTarget, { kind: "combobox" }>;

const asChoices = (options: ComboOption[]) => options.map((o, i) => ({ value: String(i), text: o.text }));

function isMultiple(el: HTMLElement): boolean {
  if (el.getAttribute("aria-multiselectable") === "true") return true;
  const id = el.getAttribute("aria-controls");
  return (id ? byIdNear(el, id) : null)?.getAttribute("aria-multiselectable") === "true";
}

async function fillChoice(t: ComboboxTarget, profile: Profile): Promise<string> {
  const options = await openOptions(t.element);
  if (options.length === 0) return "the list showed no options";
  const multiple = isMultiple(t.element);
  const values = choose(t, asChoices(options), multiple, profile);
  if (!values) {
    await closeList(t.element);
    return "";
  }
  const texts = values.map((v) => options[Number(v)].text);
  await pickOption(options[Number(values[0])]);
  // A multi-select may close after each pick; reopen it and find the next row by its text.
  for (const text of texts.slice(1)) {
    const again = await openOptions(t.element);
    const row = again.find((o) => o.text === text);
    if (row) await pickOption(row);
  }
  await closeList(t.element);
  return isComboboxEmpty(t.element) ? "the widget did not take the option" : "filled";
}

async function fillCity(t: ComboboxTarget, profile: Profile): Promise<string> {
  const saved = getText(profile, "city");
  if (!saved) return "";
  if (!(t.element instanceof HTMLInputElement)) return fillChoiceByName(t, saved);
  const names = cityNames(saved);
  for (const query of names) {
    const options = await searchOptions(t.element, query);
    const option = chooseLocation(names, asChoices(options), false);
    if (option) {
      await pickOption(options[Number(option.value)]);
      await closeList(t.element);
      return isComboboxEmpty(t.element) ? "the widget did not take the option" : "filled";
    }
  }
  await closeList(t.element, true);
  return `no result matched "${saved}"`;
}

/** A city list that cannot be searched (a button): pick the row named like the saved city. */
async function fillChoiceByName(t: ComboboxTarget, saved: string): Promise<string> {
  const options = await openOptions(t.element);
  const option = chooseLocation(cityNames(saved), asChoices(options), false);
  if (!option) {
    await closeList(t.element);
    return `no option matched "${saved}"`;
  }
  await pickOption(options[Number(option.value)]);
  await closeList(t.element);
  return "filled";
}

/**
 * A saved answer for a combobox. Saved answers come after the profile's targets, so a combobox
 * the profile filled already shows a value here and is left alone.
 */
async function fillSavedChoice(t: Extract<FieldTarget, { kind: "choiceAnswer" }>, element: HTMLElement): Promise<number> {
  if (!isComboboxEmpty(element)) {
    console.info(`Job Autofill: saved answer for "${t.question}" skipped, the profile fills this field`);
    return 0;
  }
  try {
    const why = await chooseByText({ type: "combobox", element }, t.value);
    if (!why) return 1;
    console.info(`Job Autofill: saved answer for "${t.question}" not used: ${why}`);
  } catch (err) {
    console.warn(`Job Autofill: dropdown "${t.question}" failed`, err);
  }
  return 0;
}

/** Fills ARIA comboboxes one at a time: each opens its own list, and two open lists would mix rows. */
export async function fillComboboxes(targets: FieldTarget[], profile: Profile): Promise<number> {
  let filled = 0;
  for (const t of targets) {
    if (t.kind === "choiceAnswer" && t.control.type === "combobox") {
      filled += await fillSavedChoice(t, t.control.element);
      continue;
    }
    if (t.kind !== "combobox" || !isComboboxEmpty(t.element)) continue;
    let outcome: string;
    try {
      outcome = t.fieldId === "city" ? await fillCity(t, profile) : await fillChoice(t, profile);
    } catch (err) {
      console.warn(`Job Autofill: dropdown "${t.question}" failed`, err);
      continue;
    }
    if (outcome === "filled") filled++;
    else if (outcome) console.info(`Job Autofill: dropdown "${t.question}" not filled: ${outcome}`);
  }
  return filled;
}
