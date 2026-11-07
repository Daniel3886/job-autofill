interface SelectizeInstance {
  settings: {
    valueField: string;
    labelField: string;
    mode: string;
    load?: (query: string, callback: (results?: unknown[]) => void) => void;
  };
  options: Record<string, Record<string, unknown>>;
  items: string[];
  loading: number;
  isDisabled: boolean;
  setValue(value: string | string[]): void;
  load(fn: (callback: (results?: unknown[]) => void) => void): void;
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

export async function searchSelectizeInPage(target: string, query: string) {
  const el = document.querySelector(`[data-job-autofill-target="${target}"]`) as WithSelectize | null;
  const s = el?.selectize;
  if (!el || !s) return null;

  const deadline = Date.now() + 8000;
  const wait = () => new Promise((resolve) => setTimeout(resolve, 100));
  while (s.isDisabled && Date.now() < deadline) await wait();

  const hasValue = s.items.length > 0;
  const load = s.settings.load;
  if (!hasValue && !s.isDisabled && load) {
    s.load((callback) => load.call(s, query, callback));
    while (s.loading > 0 && Date.now() < deadline) await wait();
  }

  const { valueField, labelField, mode } = s.settings;
  return {
    options: Object.values(s.options).map((o) => ({
      value: String(o[valueField]),
      text: String(o[labelField] ?? ""),
    })),
    multiple: mode === "multi" || el.multiple,
    hasValue,
  };
}
