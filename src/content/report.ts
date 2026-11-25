import type { Leftover } from "./leftovers";

export const REPORT_HOST_ID = "job-autofill-report";
const DONE_DISMISS_MS = 4000;

const STYLE = `
  :host { all: initial; }
  .panel {
    --bg: #ffffff; --fg: #1f2328; --muted: #59636e; --border: #d1d9e0; --accent: #b00020;
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
    width: min(340px, calc(100vw - 32px)); max-height: min(60vh, 480px); overflow: auto;
    box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px;
    background: var(--bg); color: var(--fg); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    .panel { --bg: #1f2328; --fg: #e6edf3; --muted: #9198a1; --border: #3d444d; --accent: #ff7b72; }
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: 14px; font-weight: 600; }
  button { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 18px;
    line-height: 1; padding: 2px 6px; border-radius: 4px; cursor: pointer; }
  button:hover, button:focus-visible { color: var(--fg); outline: 2px solid var(--border); }
  p { margin: 6px 0 0; color: var(--muted); }
  ul { margin: 8px 0 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .required { color: var(--accent); font-weight: 600; margin-left: 4px; }
`;

let removeEsc: (() => void) | null = null;

export function closeReport(doc: Document = document): void {
  doc.getElementById(REPORT_HOST_ID)?.remove();
  removeEsc?.();
  removeEsc = null;
}

/** Says the fill is still running and why, until the report replaces it. */
export function showProgress(message: string, doc: Document = document): HTMLElement {
  return showReport([], doc, message);
}

/** Shows what the fill left for the person, bottom-right. Replaces any earlier report. */
export function showReport(items: Leftover[], doc: Document = document, progress?: string): HTMLElement {
  closeReport(doc);
  const host = doc.createElement("div");
  host.id = REPORT_HOST_ID;
  const root = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const panel = doc.createElement("section");
  panel.className = "panel";
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");

  const header = doc.createElement("header");
  const title = doc.createElement("h2");
  const close = doc.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", () => closeReport(doc));
  header.append(title, close);
  panel.append(header);

  if (progress) {
    title.textContent = "Filling…";
    const note = doc.createElement("p");
    note.textContent = progress;
    panel.append(note);
  } else if (items.length === 0) {
    title.textContent = "Form filled";
    const note = doc.createElement("p");
    note.textContent = "Everything this extension can fill is filled. Check the form before you send it.";
    panel.append(note);
    doc.defaultView?.setTimeout(() => {
      if (host.isConnected) closeReport(doc);
    }, DONE_DISMISS_MS);
  } else {
    title.textContent = `Left for you (${items.length})`;
    const list = doc.createElement("ul");
    for (const item of items) {
      const li = doc.createElement("li");
      li.textContent = item.question;
      if (item.required) {
        const mark = doc.createElement("span");
        mark.className = "required";
        mark.textContent = "required";
        li.append(mark);
      }
      list.append(li);
    }
    panel.append(list);
  }

  root.append(style, panel);
  doc.body.append(host);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeReport(doc);
  };
  doc.addEventListener("keydown", onKey);
  removeEsc = () => doc.removeEventListener("keydown", onKey);
  return host;
}
