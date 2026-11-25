import { CONSENT_SETTING, getFieldText, getLanguages, getList, getText, type Profile } from "../shared/profile";
import { storedToFile, type StoredFile } from "../shared/files";
import { TARGET_ATTR, type SelectizeInfo, type SelectizeSetItem } from "../shared/messages";
import type { FieldTarget } from "./adapters/types";
import { matchSavedOption } from "./choiceControls";
import { CHOICE_RULE_BY_ID } from "./choices/choiceRules";
import { LANGUAGE_LEVEL_RULE, pickOnLevelScale } from "./choices/languages";
import { isPlaceField, matchPlaceOption } from "./choices/places";
import { chooseChoiceOptions, type ChoiceOption } from "./choices/optionMatch";
import { matchSalaryOption, salaryAmount, salaryText } from "./choices/salary";
import { acceptsFile, setFileInput } from "./drivers/file";
import { checkRadio, radioLabel } from "./drivers/radio";
import { isSelectized, isUntouched, readNativeOptions, setNativeSelect } from "./drivers/select";
import { setTextValue } from "./drivers/text";
import { formatDate, startDate } from "./dates";
import { rawQuestionText, type TextLike } from "./signals";

export type FillAction =
  | { kind: "text"; element: TextLike; value: string }
  | { kind: "select"; element: HTMLSelectElement; values: string[] }
  | { kind: "selectize"; target: string; values: string[] }
  | { kind: "radio"; element: HTMLInputElement }
  | { kind: "check"; element: HTMLInputElement }
  | { kind: "file"; element: HTMLInputElement; file: StoredFile };

export interface MainWorldBridge {
  readSelectize(targets: string[]): Promise<Record<string, SelectizeInfo | null>>;
  setSelectize(items: SelectizeSetItem[]): Promise<number>;
  searchSelectize(target: string, query: string): Promise<SelectizeInfo | null>;
}

export interface FileSource {
  loadCv(): Promise<StoredFile | null>;
}

const NO_FILES: FileSource = { loadCv: async () => null };

export async function planFills(
  targets: FieldTarget[],
  profile: Profile,
  bridge: MainWorldBridge,
  files: FileSource = NO_FILES,
  today: Date = new Date(),
): Promise<FillAction[]> {
  const actions: FillAction[] = [];
  const selectized: { tag: string; target: Extract<FieldTarget, { kind: "select" }> }[] = [];
  const answers: Extract<FieldTarget, { kind: "answer" }>[] = [];
  const choiceAnswers: Extract<FieldTarget, { kind: "choiceAnswer" }>[] = [];

  for (const t of targets) {
    if (t.kind === "answer") {
      answers.push(t);
    } else if (t.kind === "choiceAnswer") {
      choiceAnswers.push(t);
    } else if (t.kind === "text") {
      const value = t.fieldId === "salary" ? salaryText(t.question, profile) : getFieldText(profile, t.fieldId);
      if (value) actions.push({ kind: "text", element: t.element, value });
    } else if (t.kind === "select") {
      if (isSelectized(t.element)) {
        selectized.push({ tag: tagElement(t.element), target: t });
        continue;
      }
      if (!isUntouched(t.element)) continue;
      const values = choose(t, readNativeOptions(t.element), t.element.multiple, profile);
      if (values) actions.push({ kind: "select", element: t.element, values });
    } else if (t.kind === "location" || t.kind === "combobox" || t.kind === "search") {
      continue;
    } else if (t.kind === "consent") {
      if (getText(profile, CONSENT_SETTING) === "yes") actions.push({ kind: "check", element: t.element });
    } else if (t.kind === "date") {
      const date = startDate(getText(profile, "availability"), today);
      if (date) actions.push({ kind: "text", element: t.element, value: formatDate(date, t.format) });
    } else if (t.kind === "file") {
      const cv = await files.loadCv();
      if (cv && acceptsFile(t.element, cv.name, cv.type)) actions.push({ kind: "file", element: t.element, file: cv });
    } else {
      const options = t.radios.map((r, i) => ({ value: String(i), text: radioLabel(r) }));
      const values = choose(t, options, false, profile);
      if (values) actions.push({ kind: "radio", element: t.radios[Number(values[0])] });
    }
  }

  if (selectized.length > 0) {
    const infos = await bridge.readSelectize(selectized.map((s) => s.tag));
    for (const { tag, target } of selectized) {
      const info = infos[tag];
      if (!info || info.hasValue) continue;
      const options = info.options.filter((o) => o.value !== "");
      const values = choose(target, options, info.multiple, profile);
      if (values) actions.push({ kind: "selectize", target: tag, values });
    }
  }

  // A field resolves to one value: the profile's when it has one, the saved answer otherwise.
  const filledByProfile = new Set(actions.flatMap((a) => (a.kind === "text" ? [a.element] : [])));
  // A search box only keeps a value picked from its results; fillSearchBoxes uses the answer there.
  const searchBoxes = new Set<Element>(targets.flatMap((t) => (t.kind === "search" ? [t.element] : [])));
  for (const t of answers) {
    if (searchBoxes.has(t.element)) continue;
    if (filledByProfile.has(t.element)) {
      console.info(
        `Job Autofill: saved answer for "${rawQuestionText(t.element)}" skipped, the profile fills this field`,
      );
      continue;
    }
    actions.push({ kind: "text", element: t.element, value: t.value });
  }

  actions.push(...planChoiceAnswers(choiceAnswers, actions));
  return actions;
}

/**
 * Saved answers for selects and radio groups. The profile wins on a control it fills; otherwise
 * the option whose text is the saved answer is chosen, when exactly one is. Comboboxes are
 * opened later, by fillComboboxes.
 */
function planChoiceAnswers(answers: Extract<FieldTarget, { kind: "choiceAnswer" }>[], profileActions: FillAction[]): FillAction[] {
  const byProfile = new Set<Element>(
    profileActions.flatMap((a) => (a.kind === "select" || a.kind === "radio" ? [a.element] : [])),
  );
  const planned: FillAction[] = [];
  for (const t of answers) {
    const { control } = t;
    if (control.type === "combobox") continue;
    const elements = control.type === "select" ? [control.element] : control.radios;
    if (elements.some((el) => byProfile.has(el))) {
      console.info(`Job Autofill: saved answer for "${t.question}" skipped, the profile fills this field`);
      continue;
    }
    const texts = control.type === "select" ? readNativeOptions(control.element).map((o) => o.text) : control.radios.map(radioLabel);
    const index = matchSavedOption(t.value, texts);
    if (index === null) {
      console.info(`Job Autofill: saved answer for "${t.question}" not used: no single option is "${t.value}"`);
      continue;
    }
    if (control.type === "select") {
      planned.push({ kind: "select", element: control.element, values: [readNativeOptions(control.element)[index].value] });
    } else {
      planned.push({ kind: "radio", element: control.radios[index] });
    }
  }
  return planned;
}

export async function executeActions(actions: FillAction[], bridge: MainWorldBridge): Promise<number> {
  let filled = 0;
  const selectizeItems: SelectizeSetItem[] = [];
  for (const a of actions) {
    if (a.kind === "text") setTextValue(a.element, a.value);
    else if (a.kind === "select") setNativeSelect(a.element, a.values);
    else if (a.kind === "radio" || a.kind === "check") checkRadio(a.element);
    else if (a.kind === "file") setFileInput(a.element, storedToFile(a.file));
    else {
      selectizeItems.push({ target: a.target, values: a.values });
      continue;
    }
    filled++;
  }
  if (selectizeItems.length > 0) filled += await bridge.setSelectize(selectizeItems);
  return filled;
}

export function choose(t: { fieldId: string; question: string }, options: ChoiceOption[], multiple: boolean, profile: Profile): string[] | null {
  if (t.fieldId === "salary") {
    const amount = salaryAmount(t.question, profile);
    const option = amount === null ? null : matchSalaryOption(amount, options);
    return option ? [option.value] : null;
  }
  if (t.fieldId.startsWith("language:")) {
    const code = t.fieldId.slice("language:".length);
    const level = getLanguages(profile).find((l) => l.language === code)?.level;
    if (!level) return null;
    const direct = chooseChoiceOptions(LANGUAGE_LEVEL_RULE, [level], options, multiple);
    if (direct) return direct;
    const onScale = pickOnLevelScale(level, options);
    if (onScale) {
      console.info(`Job Autofill: "${t.question}" has no CEFR levels; picked "${onScale.text.trim()}" for ${level} on its scale`);
      return [onScale.value];
    }
    return null;
  }
  if (isPlaceField(t.fieldId)) {
    const option = matchPlaceOption(getText(profile, t.fieldId), options, t.fieldId);
    return option ? [option.value] : null;
  }
  const rule = CHOICE_RULE_BY_ID.get(t.fieldId);
  if (!rule) return null;
  return chooseChoiceOptions(rule, getList(profile, t.fieldId), options, multiple);
}

let tagCounter = 0;

export function tagElement(el: HTMLElement): string {
  const existing = el.getAttribute(TARGET_ATTR);
  if (existing) return existing;
  const tag = `${Date.now().toString(36)}-${tagCounter++}`;
  el.setAttribute(TARGET_ATTR, tag);
  return tag;
}
