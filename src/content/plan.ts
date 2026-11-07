import { getLanguages, getList, getText, type Profile } from "../shared/profile";
import { storedToFile, type StoredFile } from "../shared/files";
import { TARGET_ATTR, type SelectizeInfo, type SelectizeSetItem } from "../shared/messages";
import type { FieldTarget } from "./adapters/types";
import { CHOICE_RULE_BY_ID } from "./choices/choiceRules";
import { LANGUAGE_LEVEL_RULE } from "./choices/languages";
import { chooseChoiceOptions, type ChoiceOption } from "./choices/optionMatch";
import { matchSalaryOption, salaryAmount, salaryText } from "./choices/salary";
import { acceptsFile, setFileInput } from "./drivers/file";
import { checkRadio, radioLabel } from "./drivers/radio";
import { isSelectized, isUntouched, readNativeOptions, setNativeSelect } from "./drivers/select";
import { setTextValue } from "./drivers/text";
import type { TextLike } from "./signals";

export type FillAction =
  | { kind: "text"; element: TextLike; value: string }
  | { kind: "select"; element: HTMLSelectElement; values: string[] }
  | { kind: "selectize"; target: string; values: string[] }
  | { kind: "radio"; element: HTMLInputElement }
  | { kind: "file"; element: HTMLInputElement; file: StoredFile };

export interface MainWorldBridge {
  readSelectize(targets: string[]): Promise<Record<string, SelectizeInfo | null>>;
  setSelectize(items: SelectizeSetItem[]): Promise<number>;
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
): Promise<FillAction[]> {
  const actions: FillAction[] = [];
  const selectized: { tag: string; target: FieldTarget }[] = [];

  for (const t of targets) {
    if (t.kind === "text") {
      const value = t.fieldId === "salary" ? salaryText(t.question, profile) : getText(profile, t.fieldId);
      if (value) actions.push({ kind: "text", element: t.element, value });
    } else if (t.kind === "select") {
      if (isSelectized(t.element)) {
        selectized.push({ tag: tagElement(t.element), target: t });
        continue;
      }
      if (!isUntouched(t.element)) continue;
      const values = choose(t, readNativeOptions(t.element), t.element.multiple, profile);
      if (values) actions.push({ kind: "select", element: t.element, values });
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

  return actions;
}

export async function executeActions(actions: FillAction[], bridge: MainWorldBridge): Promise<number> {
  let filled = 0;
  const selectizeItems: SelectizeSetItem[] = [];
  for (const a of actions) {
    if (a.kind === "text") setTextValue(a.element, a.value);
    else if (a.kind === "select") setNativeSelect(a.element, a.values);
    else if (a.kind === "radio") checkRadio(a.element);
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

function choose(t: FieldTarget, options: ChoiceOption[], multiple: boolean, profile: Profile): string[] | null {
  if (t.fieldId === "salary") {
    const amount = salaryAmount(t.question, profile);
    const option = amount === null ? null : matchSalaryOption(amount, options);
    return option ? [option.value] : null;
  }
  if (t.fieldId.startsWith("language:")) {
    const code = t.fieldId.slice("language:".length);
    const level = getLanguages(profile).find((l) => l.language === code)?.level;
    return level ? chooseChoiceOptions(LANGUAGE_LEVEL_RULE, [level], options, multiple) : null;
  }
  const rule = CHOICE_RULE_BY_ID.get(t.fieldId);
  if (!rule) return null;
  return chooseChoiceOptions(rule, getList(profile, t.fieldId), options, multiple);
}

let tagCounter = 0;

function tagElement(el: HTMLElement): string {
  const existing = el.getAttribute(TARGET_ATTR);
  if (existing) return existing;
  const tag = `${Date.now().toString(36)}-${tagCounter++}`;
  el.setAttribute(TARGET_ATTR, tag);
  return tag;
}
