import { isTextLike, setTextValue } from "../content/drivers/text";
import { rawQuestionText, type TextLike } from "../content/signals";

export interface PickerDeps {
  saveAnswer(question: string, answer: string): Promise<void>;
  onStop?(): void;
}

export const HOST_ID = "job-autofill-picker";

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, sans-serif; }
  .ui {
    --bg: #ffffff; --fg: #1a1a1a; --muted: #5c5c5c; --border: #d0d0d0;
    --accent: #1b5fd1; --accent-fg: #ffffff; --danger: #b00020; --shade: rgb(27 95 209 / 0.12);
    color: var(--fg);
  }
  @media (prefers-color-scheme: dark) {
    .ui {
      --bg: #1f2024; --fg: #ececec; --muted: #a0a0a0; --border: #3a3b3e;
      --accent: #6ea0ff; --accent-fg: #0d1526; --danger: #ff6b78; --shade: rgb(110 160 255 / 0.16);
    }
  }
  .banner {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    padding: 8px 14px; border-radius: 8px; font-size: 13px;
    background: var(--bg); color: var(--fg); border: 1px solid var(--border);
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.25); pointer-events: auto;
  }
  kbd { font: inherit; padding: 0 5px; border: 1px solid var(--border); border-radius: 4px; }
  .highlight {
    position: fixed; border: 2px solid var(--accent); background: var(--shade);
    border-radius: 4px; pointer-events: none;
  }
  [hidden] { display: none !important; }
  .panel {
    position: fixed; width: min(360px, calc(100vw - 24px)); display: grid; gap: 10px;
    padding: 14px; border-radius: 10px; background: var(--bg); color: var(--fg);
    border: 1px solid var(--border); box-shadow: 0 10px 32px rgb(0 0 0 / 0.3); pointer-events: auto;
  }
  h2 { margin: 0; font-size: 15px; }
  label { display: grid; gap: 4px; font-size: 13px; font-weight: 600; }
  textarea, input {
    font: inherit; font-size: 14px; font-weight: 400; padding: 7px 9px; border-radius: 6px;
    border: 1px solid var(--border); background: transparent; color: inherit; resize: vertical;
  }
  textarea:focus, input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .hint { margin: 0; font-size: 12px; color: var(--muted); }
  .error { margin: 0; font-size: 12px; color: var(--danger); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button { font: inherit; font-size: 13px; padding: 7px 12px; border-radius: 6px; cursor: pointer; }
  .primary { border: 0; background: var(--accent); color: var(--accent-fg); }
  .secondary { border: 1px solid var(--border); background: transparent; color: var(--fg); }
`;

export function startPicker(doc: Document, deps: PickerDeps): () => void {
  doc.getElementById(HOST_ID)?.remove();

  const host = doc.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>${CSS}</style>
    <div class="ui">
      <div class="banner" role="status">Click a text field to save an answer for it. <kbd>Esc</kbd> cancels.</div>
      <div class="highlight" hidden></div>
    </div>`;
  doc.documentElement.append(host);

  const ui = root.querySelector<HTMLDivElement>(".ui")!;
  const banner = root.querySelector<HTMLDivElement>(".banner")!;
  const highlight = root.querySelector<HTMLDivElement>(".highlight")!;
  let hovered: TextLike | null = null;
  let panel: HTMLFormElement | null = null;
  let stopped = false;

  const isOurs = (e: Event) => e.composedPath().includes(host);

  function place(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      top: `${r.top - 2}px`,
      left: `${r.left - 2}px`,
      width: `${r.width + 4}px`,
      height: `${r.height + 4}px`,
    });
    highlight.hidden = false;
  }

  function onMove(e: MouseEvent) {
    if (panel || isOurs(e)) return;
    hovered = isTextLike(e.target) ? e.target : null;
    if (hovered) place(hovered);
    else highlight.hidden = true;
  }

  function onClick(e: MouseEvent) {
    if (isOurs(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (panel || !isTextLike(e.target)) return;
    openPanel(e.target);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    stop();
  }

  function onScroll() {
    const el = panelTarget ?? hovered;
    if (el) place(el);
  }

  let panelTarget: TextLike | null = null;

  function openPanel(el: TextLike) {
    panelTarget = el;
    place(el);
    banner.textContent = "Type the answer for this question.";

    panel = doc.createElement("form");
    panel.className = "panel";
    panel.innerHTML = `
      <h2>Save an answer</h2>
      <label>Question
        <textarea name="question" rows="2"></textarea>
      </label>
      <p class="hint">Filled in from the field's label. Edit it if it's wrong. This is what autofill looks for.</p>
      <label>Answer
        <input name="answer" type="text">
      </label>
      <p class="error" hidden></p>
      <div class="actions">
        <button type="button" class="secondary" data-action="cancel">Cancel</button>
        <button type="submit" class="primary">Save and fill</button>
      </div>`;
    ui.append(panel);

    const question = panel.querySelector<HTMLTextAreaElement>('[name="question"]')!;
    const answer = panel.querySelector<HTMLInputElement>('[name="answer"]')!;
    const error = panel.querySelector<HTMLParagraphElement>(".error")!;
    question.value = rawQuestionText(el);
    answer.value = el.value;
    positionPanel(panel, el);

    panel.querySelector('[data-action="cancel"]')!.addEventListener("click", closePanel);
    panel.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = question.value.replace(/\s+/g, " ").trim();
      const a = answer.value;
      const showError = (text: string) => {
        error.textContent = text;
        error.hidden = false;
      };
      if (!q) return showError("Add the question this answer belongs to.");
      if (!a.trim()) return showError("Type the answer to save.");
      try {
        await deps.saveAnswer(q, a);
      } catch {
        return showError("Could not save the answer. Try again.");
      }
      setTextValue(el, a);
      panel?.remove();
      panel = null;
      banner.textContent = "Saved. Autofill will fill this question from now on.";
      setTimeout(stop, 1500);
    });
    (answer.value ? question : answer).focus();
  }

  function positionPanel(form: HTMLFormElement, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const view = doc.defaultView;
    const vw = view?.innerWidth ?? 1024;
    const vh = view?.innerHeight ?? 768;
    const width = Math.min(360, vw - 24);
    const left = Math.max(12, Math.min(r.left, vw - width - 12));
    const below = r.bottom + 8;
    const fitsBelow = below + 280 <= vh;
    form.style.left = `${left}px`;
    if (fitsBelow) form.style.top = `${below}px`;
    else form.style.bottom = `${Math.max(12, vh - r.top + 8)}px`;
  }

  function closePanel() {
    panel?.remove();
    panel = null;
    panelTarget = null;
    highlight.hidden = true;
    banner.innerHTML = "Click a text field to save an answer for it. <kbd>Esc</kbd> cancels.";
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    doc.removeEventListener("mousemove", onMove, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("scroll", onScroll, true);
    host.remove();
    deps.onStop?.();
  }

  doc.addEventListener("mousemove", onMove, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKey, true);
  doc.addEventListener("scroll", onScroll, true);

  return stop;
}
