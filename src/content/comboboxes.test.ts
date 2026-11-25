import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../shared/profile";
import { collectTargets } from "./adapters";
import { fillComboboxes } from "./comboboxes";
import { executeActions, planFills, type MainWorldBridge } from "./plan";

const PROFILE: Profile = {
  version: 1,
  values: { city: "Warsaw", country: "Poland", workMode: ["remote"], contractTypes: ["uop", "b2b"] },
};

const bridge: MainWorldBridge = {
  readSelectize: vi.fn(async () => ({})),
  setSelectize: vi.fn(async () => 0),
  searchSelectize: vi.fn(async () => null),
};

/** A react-select-like widget: an input that opens a listbox on mousedown. */
function reactSelect(id: string, label: string, options: string[], chosen = "") {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <label id="${id}-label" for="${id}">${label}</label>
    <div class="select__container"><div class="select__control"><div class="select__value-container">
      ${chosen ? `<div class="select__single-value">${chosen}</div>` : `<div class="select__placeholder">Select...</div>`}
      <input id="${id}" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-labelledby="${id}-label">
    </div></div></div>`;
  document.body.append(wrap);
  const input = wrap.querySelector<HTMLInputElement>("input")!;
  const opened = vi.fn();
  input.addEventListener("mousedown", () => {
    opened();
    if (document.getElementById(`${id}-list`)) return;
    const list = document.createElement("div");
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    for (const text of options) {
      const row = document.createElement("div");
      row.setAttribute("role", "option");
      row.textContent = text;
      row.addEventListener("click", () => {
        wrap.querySelector(".select__placeholder, .select__single-value")!.outerHTML = `<div class="select__single-value">${text}</div>`;
        list.remove();
        input.setAttribute("aria-expanded", "false");
      });
      list.append(row);
    }
    wrap.append(list);
    input.setAttribute("aria-expanded", "true");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.getElementById(`${id}-list`)?.remove();
  });
  return { input, wrap, opened };
}

/** A Radix-like Select: a button with a placeholder span, its list portalled to <body>. */
function radixSelect(id: string, label: string, options: string[]) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<label for="${id}">${label}</label>
    <button id="${id}" type="button" role="combobox" aria-controls="${id}-list" aria-expanded="false"><span data-placeholder>Wybierz</span></button>`;
  document.body.append(wrap);
  const button = wrap.querySelector<HTMLButtonElement>("button")!;
  button.addEventListener("pointerdown", () => {
    const list = document.createElement("div");
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    list.innerHTML = options.map((o) => `<div role="option">${o}</div>`).join("");
    for (const row of list.querySelectorAll<HTMLElement>("[role=option]")) {
      row.addEventListener("pointerup", () => {
        button.innerHTML = `<span>${row.textContent}</span>`;
        list.remove();
      });
    }
    document.body.append(list);
  });
  return button;
}

/** A location autocomplete: rows arrive a moment after typing. */
function cityAutocomplete(id: string, places: string[]) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<label for="${id}">Location (city)</label>
    <input id="${id}" role="combobox" aria-autocomplete="list" aria-controls="${id}-list"><div id="${id}-list" role="listbox"></div>`;
  document.body.append(wrap);
  const input = wrap.querySelector<HTMLInputElement>("input")!;
  const list = wrap.querySelector<HTMLElement>("[role=listbox]")!;
  const queries: string[] = [];
  input.addEventListener("input", () => {
    const q = input.value;
    queries.push(q);
    setTimeout(() => {
      list.innerHTML = "";
      for (const place of places.filter((p) => q && p.startsWith(q))) {
        const row = document.createElement("div");
        row.setAttribute("role", "option");
        row.textContent = place;
        row.addEventListener("click", () => {
          input.value = place;
          list.innerHTML = "";
        });
        list.append(row);
      }
    }, 30);
  });
  return { input, queries };
}

async function fillPage(profile = PROFILE) {
  const targets = collectTargets(document, false);
  const actions = await planFills(targets, profile, bridge);
  return (await executeActions(actions, bridge)) + (await fillComboboxes(targets, profile));
}

describe("ARIA comboboxes", () => {
  it("opens a react-select list and clicks the one option that matches", async () => {
    document.body.innerHTML = "";
    const { wrap } = reactSelect("mode", "Work mode", ["Office", "Hybrid (2 days)", "Remote"]);
    expect(await fillPage()).toBe(1);
    expect(wrap.querySelector(".select__single-value")!.textContent).toBe("Remote");
    expect(document.getElementById("mode-list")).toBeNull();
  });

  it("closes the list without choosing when more than one option matches", async () => {
    document.body.innerHTML = "";
    const { wrap } = reactSelect("contract", "Contract type", ["Employment contract", "B2B", "Other"]);
    expect(await fillPage()).toBe(0);
    expect(wrap.querySelector(".select__single-value")).toBeNull();
    expect(document.getElementById("contract-list")).toBeNull();
  });

  it("never opens a dropdown that already shows a value", async () => {
    document.body.innerHTML = "";
    const { opened, wrap } = reactSelect("mode", "Work mode", ["Office", "Remote"], "Office");
    expect(await fillPage()).toBe(0);
    expect(opened).not.toHaveBeenCalled();
    expect(wrap.querySelector(".select__single-value")!.textContent).toBe("Office");
  });

  it("does not type into a combobox input as if it were a text field", async () => {
    document.body.innerHTML = "";
    const { input } = reactSelect("country", "Country", ["Germany", "Spain"]);
    await fillPage();
    expect(input.value).toBe("");
  });

  it("picks a country in a Radix-style select across languages", async () => {
    document.body.innerHTML = "";
    const button = radixSelect("kraj", "Kraj", ["Niemcy", "Polska", "Czechy"]);
    expect(await fillPage()).toBe(1);
    expect(button.textContent).toBe("Polska");
  });

  it("searches a location autocomplete by the Polish name and picks the city", async () => {
    document.body.innerHTML = "";
    const { input, queries } = cityAutocomplete("loc", ["Warszawa, Mazowieckie", "Warszówka", "Wrocław"]);
    expect(await fillPage()).toBe(1);
    expect(input.value).toBe("Warszawa, Mazowieckie");
    expect(queries).toEqual(["Warsaw", "Warszawa"]);
  });

  it("does not take a lone result that is another place", async () => {
    document.body.innerHTML = "";
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { input } = cityAutocomplete("loc", ["Warsaw Chopin Airport"]);
    expect(await fillPage()).toBe(0);
    expect(input.value).toBe("");
    vi.restoreAllMocks();
  }, 15000);

  it("clears its own search when no result names the city", async () => {
    document.body.innerHTML = "";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { input } = cityAutocomplete("loc", ["Kraków", "Gdańsk"]);
    expect(await fillPage({ version: 1, values: { city: "Kraków Nowa Huta" } })).toBe(0);
    expect(input.value).toBe("");
    expect(info).toHaveBeenCalledWith(expect.stringContaining('not filled: no result matched "Kraków Nowa Huta"'));
    info.mockRestore();
  }, 15000);
});
