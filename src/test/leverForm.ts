/**
 * Lever's apply form (jobs.lever.co/<company>/<id>/apply), reduced to the parts that matter:
 * each question is a <label> that wraps its field, and "Current location" is a search box whose
 * dropdown text lives inside that label. The behaviour mirrors Lever's own location script: it
 * searches on keydown (debounced), shows rows as `.dropdown-location`, takes a row on mousedown
 * (writing the place as JSON into #selected-location), and clears the box on blur when the
 * dropdown is still open, so a value that was typed but not chosen is thrown away.
 */
export const LEVER_FORM = `
<style>.dropdown-container, .dropdown-no-results, .dropdown-loading-results { display: none; }</style>
<form id="application-form">
  <ul>
    <li class="application-question"><label><div class="application-label">Full name <span class="required">✱</span></div>
      <div class="application-field"><input type="text" name="name" required></div></label></li>
    <li class="application-question"><label><div class="application-label">Email <span class="required">✱</span></div>
      <div class="application-field"><input type="email" name="email" required></div></label></li>
    <li class="application-question"><label><div class="application-label">Phone <span class="required">✱</span></div>
      <div class="application-field"><input type="text" name="phone" required></div></label></li>
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

export interface LeverLocation {
  input: HTMLInputElement;
  selected: HTMLInputElement;
  /** Every search the page ran. */
  searches: string[];
}

/** Renders the form and wires up the location box like Lever's script. */
export function mountLeverForm(places: string[], delayMs = 20): LeverLocation {
  document.body.innerHTML = LEVER_FORM;
  const input = document.querySelector<HTMLInputElement>("input.location-input")!;
  const selected = document.querySelector<HTMLInputElement>("#selected-location")!;
  const show = (sel: string, on: boolean) => {
    document.querySelector<HTMLElement>(sel)!.style.display = on ? "flex" : "none";
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
    if (document.querySelector<HTMLElement>(".dropdown-container")!.style.display !== "none" &&
        getComputedStyle(document.querySelector(".dropdown-container")!).display !== "none") {
      show(".dropdown-container", false);
      empty();
      input.value = "";
      selected.value = "";
    }
  });
  document.addEventListener("mousedown", (e) => {
    const row = (e.target as Element).closest?.(".dropdown-location");
    if (!row) return;
    show(".dropdown-container", false);
    input.value = row.textContent ?? "";
    selected.value = JSON.stringify({ name: found[Number(row.id.split("-")[1])] });
    empty();
  });
  return { input, selected, searches };
}
