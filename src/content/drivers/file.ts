export function setFileInput(el: HTMLInputElement, file: File): void {
  const dt = new DataTransfer();
  dt.items.add(file);
  el.files = dt.files;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function acceptsFile(el: HTMLInputElement, name: string, type: string): boolean {
  const accept = el.accept.trim();
  if (!accept) return true;
  const lowerName = name.toLowerCase();
  return accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .some((token) => {
      if (token.startsWith(".")) return lowerName.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return token === type;
    });
}
