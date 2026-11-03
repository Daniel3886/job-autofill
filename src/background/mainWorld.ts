// Functions that Chrome serialises and runs in the page's MAIN world, where
// the page's own JavaScript objects (like Selectize instances) exist.
// They must be self-contained: no imports, no references to outer variables.

interface SelectizeInstance {
  settings: { valueField: string; labelField: string; mode: string };
  options: Record<string, Record<string, unknown>>;
  items: string[];
  setValue(value: string | string[]): void;
}

type WithSelectize = HTMLSelectElement & { selectize?: SelectizeInstance };

export function readSelectizeInPage(targets: string[]) {
  const out: Record<
    string,
    { options: { value: string; text: string }[]; multiple: boolean; hasValue: boolean } | null
  > = {};
  for (const target of targets) {
    const el = document.querySelector(`[data-job-autofill-target="${target}"]`) as WithSelectize | null;
    const s = el?.selectize;
    if (!el || !s) {
      out[target] = null;
      continue;
    }
    const { valueField, labelField, mode } = s.settings;
    out[target] = {
      options: Object.values(s.options).map((o) => ({
        value: String(o[valueField]),
        text: String(o[labelField] ?? ""),
      })),
      multiple: mode === "multi" || el.multiple,
      hasValue: s.items.length > 0,
    };
  }
  return out;
}

export function setSelectizeInPage(items: { target: string; values: string[] }[]) {
  let filled = 0;
  for (const { target, values } of items) {
    const el = document.querySelector(`[data-job-autofill-target="${target}"]`) as WithSelectize | null;
    const s = el?.selectize;
    if (!el || !s) continue;
    const multiple = s.settings.mode === "multi" || el.multiple;
    s.setValue(multiple ? values : values[0]);
    filled++;
  }
  return filled;
}
