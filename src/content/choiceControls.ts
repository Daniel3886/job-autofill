import { cleanOptionText } from "./choices/optionMatch";
import { closeList, isCombobox, isComboboxEmpty, openOptions, pickOption } from "./drivers/combobox";
import { checkRadio, commonAncestor, radioGroupOf, radioLabel, rawGroupQuestion } from "./drivers/radio";
import { isUntouched, readNativeOptions, setNativeSelect } from "./drivers/select";
import { rawQuestionText } from "./signals";
import { normalize } from "./text";

/** A question answered by choosing one option: a native select, a radio group or an ARIA combobox. */
export type ChoiceControl =
  | { type: "select"; element: HTMLSelectElement }
  | { type: "radio"; radios: HTMLInputElement[] }
  | { type: "combobox"; element: HTMLElement };

/** The choice control a click landed on: a select or its option, a radio or its label, a combobox. */
export function choiceControlAt(target: EventTarget | null): ChoiceControl | null {
  if (!(target instanceof Element)) return null;
  const select = target.closest("select");
  if (select) return select.disabled || select.multiple ? null : { type: "select", element: select };

  const control = target.closest("label")?.control;
  const radio =
    target instanceof HTMLInputElement && target.type === "radio"
      ? target
      : control instanceof HTMLInputElement && control.type === "radio"
        ? control
        : null;
  if (radio) return radio.disabled ? null : { type: "radio", radios: radioGroupOf(radio) };

  for (let node: Element | null = target; node; node = node.parentElement) {
    if (isCombobox(node)) return { type: "combobox", element: node };
  }
  return null;
}

/** The element to highlight and to place the picker's panel next to. */
export function anchorOf(control: ChoiceControl): HTMLElement {
  if (control.type !== "radio") return control.element;
  return commonAncestor(control.radios) ?? control.radios[0];
}

export function choiceQuestion(control: ChoiceControl): string {
  if (control.type === "radio") return rawGroupQuestion(control.radios);
  return rawQuestionText(control.element);
}

/** Nothing chosen yet. */
export function isChoiceEmpty(control: ChoiceControl): boolean {
  if (control.type === "select") return isUntouched(control.element);
  if (control.type === "radio") return !control.radios.some((r) => r.checked);
  return isComboboxEmpty(control.element);
}

/** The visible text of the option chosen now, or "" when nothing is chosen. */
export function chosenText(control: ChoiceControl): string {
  if (isChoiceEmpty(control)) return "";
  if (control.type === "select") return control.element.selectedOptions[0]?.textContent?.trim() ?? "";
  if (control.type === "radio") {
    const checked = control.radios.find((r) => r.checked);
    return checked ? radioLabel(checked) : "";
  }
  const el = control.element;
  return (el instanceof HTMLInputElement ? el.value : (el.textContent ?? "")).trim();
}

/** The options' visible texts. A combobox is opened to read them and closed again. */
export async function readChoiceTexts(control: ChoiceControl): Promise<string[]> {
  if (control.type === "select") return readNativeOptions(control.element).map((o) => o.text.trim());
  if (control.type === "radio") return control.radios.map(radioLabel);
  const rows = await openOptions(control.element);
  await closeList(control.element);
  return rows.map((r) => r.text);
}

/**
 * The index of the one option whose text is the saved answer, or null when none or several are.
 * Texts are compared normalised; an "a) " style prefix is ignored only when that finds nothing.
 */
export function matchSavedOption(saved: string, texts: string[]): number | null {
  const comparisons = [
    (t: string) => normalize(t) === normalize(saved),
    (t: string) => cleanOptionText(t) === cleanOptionText(saved),
  ];
  for (const same of comparisons) {
    const hits = texts.flatMap((t, i) => (same(t) ? [i] : []));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null;
  }
  return null;
}

/**
 * Chooses the option whose text is `text`. Returns "" when it did, otherwise why not.
 * A control that already has an answer is left as it is, unless `replace` is set: the field
 * picker sets it when the person has just chosen the answer for this very control.
 */
export async function chooseByText(control: ChoiceControl, text: string, { replace = false } = {}): Promise<string> {
  if (!replace && !isChoiceEmpty(control)) return "it already has an answer";
  if (control.type === "select") {
    const options = readNativeOptions(control.element);
    const index = matchSavedOption(text, options.map((o) => o.text));
    if (index === null) return `no single option is "${text}"`;
    setNativeSelect(control.element, [options[index].value]);
    return "";
  }
  if (control.type === "radio") {
    const index = matchSavedOption(text, control.radios.map(radioLabel));
    if (index === null) return `no single option is "${text}"`;
    checkRadio(control.radios[index]);
    return "";
  }
  const rows = await openOptions(control.element);
  const index = matchSavedOption(text, rows.map((r) => r.text));
  if (index === null) {
    await closeList(control.element);
    return rows.length === 0 ? "the list showed no options" : `no single option is "${text}"`;
  }
  await pickOption(rows[index]);
  await closeList(control.element);
  return isComboboxEmpty(control.element) ? "the widget did not take the option" : "";
}
