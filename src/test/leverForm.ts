/**
 * Lever's apply form (jobs.lever.co/<company>/<id>/apply), reduced to the parts that matter:
 * each question is a <label> that wraps its field, and "Current location" is a search box whose
 * dropdown text lives inside that label. The behaviour mirrors Lever's own location script: it
 * searches on keydown (debounced), shows rows as `.dropdown-location`, takes a row on mousedown
 * (writing the place as JSON into #selected-location), and clears the box on blur when the
 * dropdown is still open, so a value that was typed but not chosen is thrown away.
 */
export const LEVER_FORM = `
<style>
  .dropdown-container, .dropdown-no-results, .dropdown-loading-results { display: none; }
  .resume-upload-working, .resume-upload-success, .resume-upload-failure { display: none; }
</style>
<form id="application-form">
  <ul>
    <li class="application-question"><label><div class="application-label">Resume/CV <span class="required">✱</span></div>
      <div class="application-field"><input type="file" id="resume-upload-input" name="resume">
        <span class="resume-upload-working">Parsing</span><span class="resume-upload-success">Success!</span>
        <span class="resume-upload-failure">Couldn't auto-read resume.</span></div></label></li>
    <li class="application-question"><label><div class="application-label">Full name <span class="required">✱</span></div>
      <div class="application-field"><input type="text" name="name" required></div></label></li>
    <li class="application-question"><label><div class="application-label">Email <span class="required">✱</span></div>
      <div class="application-field"><input type="email" name="email" required></div></label></li>
    <li class="application-question"><label><div class="application-label">Phone <span class="required">✱</span></div>
      <div class="application-field"><input type="text" name="phone" required></div></label></li>
    <li class="application-question"><label><div class="application-label">Current company <span class="required">✱</span></div>
      <div class="application-field"><input type="text" name="org" required></div></label></li>
    <li class="application-question" data-qa="structured-contact-location-question"><label>
      <div class="application-label">Current location <span class="required">✱</span></div>
      <div class="application-field">
        <input class="location-input" id="location-input" type="text" maxlength="100" name="location" required>
        <input id="selected-location" type="hidden" name="selectedLocation">
        <div class="dropdown-container">
          <div class="dropdown-results"></div>
          <div class="dropdown-no-results">No location found. Try entering a different location</div>
          <div class="dropdown-loading-results">Loading</div>
        </div>
      </div></label></li>
  </ul>
</form>`;

/** What Lever's résumé parser "finds" in the uploaded CV. */
export interface ParsedCv {
  position?: string;
  phone?: string;
  location?: { name: string };
}

export interface LeverLocation {
  input: HTMLInputElement;
  selected: HTMLInputElement;
  /** Every search the page ran. */
  searches: string[];
}

/**
 * Renders the form and wires up the location box like Lever's script. With `parsed`, attaching
 * a CV runs the résumé parser: it shows "Parsing", waits `parseMs`, then writes the parsed values
 * into every listed field nobody changed (a change/paste event marks a field as changed), and
 * always into the hidden #selected-location.
 */
export function mountLeverForm(places: string[], delayMs = 20, parsed?: ParsedCv, parseMs = 150): LeverLocation {
  document.body.innerHTML = LEVER_FORM;
  const form = document.querySelector<HTMLFormElement>("#application-form")!;
  const input = form.querySelector<HTMLInputElement>("input.location-input")!;
  const selected = document.querySelector<HTMLInputElement>("#selected-location")!;
  const show = (sel: string, on: boolean) => {
    form.querySelector<HTMLElement>(sel)!.style.display = on ? "flex" : "none";
  };
  const results = document.querySelector<HTMLElement>(".dropdown-results")!;
  const searches: string[] = [];
  let found: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const empty = () => {
    results.innerHTML = "";
    show(".dropdown-no-results", false);
    show(".dropdown-loading-results", false);
    found = [];
  };

  input.addEventListener("input", () => show(".dropdown-container", true));
  input.addEventListener("keydown", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      empty();
      const q = input.value;
      if (!q) return;
      searches.push(q);
      show(".dropdown-loading-results", true);
      setTimeout(() => {
        show(".dropdown-loading-results", false);
        found = places.filter((p) => p.toLowerCase().startsWith(q.toLowerCase()));
        found.forEach((name, i) => {
          results.insertAdjacentHTML("beforeend", `<div class="dropdown-location" id="location-${i}">${name}</div>`);
        });
        if (found.length === 0) show(".dropdown-no-results", true);
      }, delayMs);
    }, delayMs);
  });
  input.addEventListener("blur", () => {
    if (getComputedStyle(form.querySelector(".dropdown-container")!).display !== "none") {
      show(".dropdown-container", false);
      empty();
      input.value = "";
      selected.value = "";
    }
  });
  form.addEventListener("mousedown", (e) => {
    const row = (e.target as Element).closest?.(".dropdown-location");
    if (!row) return;
    show(".dropdown-container", false);
    input.value = row.textContent ?? "";
    selected.value = JSON.stringify({ name: found[Number(row.id.split("-")[1])] });
    empty();
  });
  if (parsed) {
    stubFileUpload(document.querySelector<HTMLInputElement>("#resume-upload-input")!);
    const touched = new Set<Element>();
    const parsedFields = ["org", "phone", "name", "email", "location"].map(
      (name) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!,
    );
    for (const f of parsedFields) for (const type of ["change", "paste"]) f.addEventListener(type, () => touched.add(f));
    const write = (f: HTMLInputElement, value: string | undefined) => {
      if (!(touched.has(f) && f.value)) f.value = value ?? "";
    };
    // Captured now: a parse still running when the next test mounts must not touch its form.
    const [org, phone] = parsedFields;
    const shown = (sel: string, on: boolean) => {
      form.querySelector<HTMLElement>(sel)!.style.display = on ? "inline" : "none";
    };
    document.querySelector("#resume-upload-input")!.addEventListener("change", () => {
      shown(".resume-upload-working", true);
      setTimeout(() => {
        shown(".resume-upload-working", false);
        shown(".resume-upload-success", true);
        write(org, parsed.position);
        write(phone, parsed.phone);
        write(input, parsed.location?.name);
        write(selected, JSON.stringify(parsed.location));
      }, parseMs);
    });
  }
  return { input, selected, searches };
}

/**
 * jsdom has no DataTransfer and only accepts its own FileList on `input.files`. This lets the
 * extension's upload code (DataTransfer, then `input.files = …`) run on one input.
 */
function stubFileUpload(input: HTMLInputElement): void {
  class FakeDataTransfer {
    private list: File[] = [];
    items = { add: (file: File) => this.list.push(file) };
    get files() {
      return Object.assign([...this.list], { item: (i: number) => this.list[i] ?? null });
    }
  }
  (globalThis as { DataTransfer?: unknown }).DataTransfer ??= FakeDataTransfer;
  let files: unknown = [];
  Object.defineProperty(input, "files", {
    get: () => files,
    set: (v) => {
      files = v;
    },
    configurable: true,
  });
}
