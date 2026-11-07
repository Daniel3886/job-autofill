export function isSelectized(el: HTMLSelectElement): boolean {
  return (
    el.classList.contains("selectized") ||
    el.nextElementSibling?.classList.contains("selectize-control") === true
  );
}

export function isUntouched(el: HTMLSelectElement): boolean {
  if (el.multiple) return el.selectedOptions.length === 0;
  const opt = el.options[el.selectedIndex];
  return !opt || el.selectedIndex === 0 || opt.value === "" || opt.defaultSelected;
}

export function readNativeOptions(el: HTMLSelectElement): { value: string; text: string }[] {
  return [...el.options]
    .filter((o) => o.value !== "")
    .map((o) => ({ value: o.value, text: o.textContent ?? "" }));
}

export function setNativeSelect(el: HTMLSelectElement, values: string[]): void {
  if (el.multiple) {
    for (const o of el.options) o.selected = values.includes(o.value);
  } else {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(el, values[0]);
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
