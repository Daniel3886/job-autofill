import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../shared/profile";
import type { SelectizeInfo } from "../shared/messages";
import { collectTargets } from "./adapters";
import { chooseLocation, cityNames, fillLocations } from "./location";
import { executeActions, planFills, type MainWorldBridge } from "./plan";

const PROFILE: Profile = {
  version: 1,
  values: {
    firstName: "Daniel",
    lastName: "Kowalski",
    email: "daniel@example.com",
    phone: "123456789",
    city: "Warszawa",
    availability: "2w",
    contractTypes: ["b2b"],
    workMode: ["hybrid", "remote"],
  },
  salaries: [
    { amount: "15000", contract: "b2b", period: "month", basis: "net" },
    { amount: "120", contract: "b2b", period: "hour", basis: "net" },
  ],
  languages: [
    { language: "en", level: "C1" },
    { language: "de", level: "B1" },
  ],
};

function noMainWorld(): MainWorldBridge {
  return {
    readSelectize: vi.fn(async () => ({})),
    setSelectize: vi.fn(async () => 0),
    searchSelectize: vi.fn(async () => null),
  };
}

async function fill(html: string, profile = PROFILE, bridge = noMainWorld()) {
  document.body.innerHTML = html;
  const targets = collectTargets(document, false);
  const actions = await planFills(targets, profile, bridge);
  const filled = (await executeActions(actions, bridge)) + (await fillLocations(targets, profile, bridge));
  return { filled, bridge };
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const group = (id: string, label: string, control: string) => `
  <div class="form-group">
    <div class="sub-title"></div>
    <label class="required" for="${id}">${label}</label>
    <span class="required-star">*</span>
    ${control}
  </div>`;

const TRAFFIT = `
  <div class="traffit-public-form">
    <form name="dynamic_form">
      ${group("f1", "Imię", '<input type="text" id="f1" data-sid="firstName">')}
      ${group("f2", "Nazwisko", '<input type="text" id="f2" data-sid="lastName">')}
      ${group("f3", "Email", '<input type="text" id="f3" data-sid="email" autocomplete="email">')}
      ${group("f4", "Telefon komórkowy", '<input type="text" id="f4" data-sid="mobile">')}
      <div class="form__geo-wrapper">
        ${group(
          "country-selectized",
          "Twoja lokalizacja (Kraj)",
          `<select id="country" class="location-select country selectized" style="display:none"></select>
          <div class="selectize-control single"><div class="selectize-input">
            <input type="text" id="country-selectized" placeholder="Wpisz coś, aby wyszukać lokalizację">
          </div></div>`,
        )}
        ${group(
          "loc-selectized",
          "Twoja lokalizacja (Miasto)",
          `<select id="loc" class="location-select city selectized" style="display:none"></select>
          <div class="selectize-control single"><div class="selectize-input">
            <input type="text" id="loc-selectized" placeholder="Wpisz coś, aby wyszukać lokalizację">
          </div></div>`,
        )}
      </div>
      ${group(
        "en-selectized",
        "Poziom znajomości języka angielskiego",
        `<select id="en"><option value="429">A1</option><option value="432">B2</option><option value="433">C1</option></select>`,
      )}
      ${group(
        "de-selectized",
        "Poziom znajomości języka niemieckiego",
        `<select id="de"><option value="1">A2</option><option value="2">B1</option><option value="3">B2</option></select>`,
      )}
      ${group(
        "fr-selectized",
        "Poziom znajomości języka francuskiego",
        `<select id="fr"><option value="1">A2</option><option value="2">B1</option></select>`,
      )}
      ${group(
        "av-selectized",
        "Dostępność",
        `<select id="av"><option value="442">a) "od zaraz"</option><option value="443">c) 2 tygodnie</option><option value="446">d) 30 dni</option></select>`,
      )}
      ${group(
        "ct-selectized",
        "Możliwe formy współpracy",
        `<select id="ct" multiple><option value="459">umowa o pracę</option><option value="461">umowa o współpracy (B2B)</option></select>`,
      )}
      ${group(
        "sal-selectized",
        "Oczekiwania finansowe (brutto UoP, netto B2B)",
        `<select id="sal"><option value="463">b) 8500 - 10000 PLN</option><option value="465">e) 14500 - 16000 PLN</option></select>`,
      )}
      ${group(
        "wm-selectized",
        "Model pracy (tryb pracy)",
        `<select id="wm" class="selectized" style="display:none"></select><div class="selectize-control single"></div>`,
      )}
    </form>
  </div>`;

describe("Traffit adapter", () => {
  it("fills text fields by data-sid and native selects by option text", async () => {
    const { filled } = await fill(TRAFFIT);
    expect($<HTMLInputElement>("#f1").value).toBe("Daniel");
    expect($<HTMLInputElement>("#f2").value).toBe("Kowalski");
    expect($<HTMLInputElement>("#f3").value).toBe("daniel@example.com");
    expect($<HTMLInputElement>("#f4").value).toBe("123456789");
    expect($<HTMLSelectElement>("#en").value).toBe("433");
    expect($<HTMLSelectElement>("#de").value).toBe("2");
    expect($<HTMLSelectElement>("#fr").value).toBe("1");
    expect($<HTMLSelectElement>("#av").value).toBe("443");
    expect([...$<HTMLSelectElement>("#ct").selectedOptions].map((o) => o.value)).toEqual(["461"]);
    expect($<HTMLSelectElement>("#sal").value).toBe("465");
    expect(filled).toBe(9);
  });

  it("does not type into the location search boxes", async () => {
    const { bridge } = await fill(TRAFFIT);
    expect($<HTMLInputElement>("#country-selectized").value).toBe("");
    expect($<HTMLInputElement>("#loc-selectized").value).toBe("");
    expect(bridge.readSelectize).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bridge.readSelectize).mock.calls[0][0]).toHaveLength(1);
  });

  const info: SelectizeInfo = {
    multiple: false,
    hasValue: false,
    options: [
      { value: "478", text: "a) stacjonarny" },
      { value: "479", text: "b) hybrydowy - 2-3 dni w tygodniu w biurze" },
      { value: "481", text: "f) zdalny" },
    ],
  };

  it("reads and sets Selectize options through the MAIN world bridge", async () => {
    const bridge: MainWorldBridge = {
      readSelectize: vi.fn(async (targets: string[]) => ({ [targets[0]]: info })),
      setSelectize: vi.fn(async (items) => items.length),
      searchSelectize: vi.fn(async () => null),
    };
    await fill(TRAFFIT, { ...PROFILE, values: { ...PROFILE.values, workMode: ["remote"] } }, bridge);
    const tag = $("#wm").getAttribute("data-job-autofill-target")!;
    expect(bridge.setSelectize).toHaveBeenCalledWith([{ target: tag, values: ["481"] }]);
  });

  it("skips a single-choice work mode when two accepted modes both match", async () => {
    const bridge: MainWorldBridge = {
      readSelectize: vi.fn(async (targets: string[]) => ({ [targets[0]]: info })),
      setSelectize: vi.fn(async (items) => items.length),
      searchSelectize: vi.fn(async () => null),
    };
    await fill(TRAFFIT, PROFILE, bridge);
    expect(bridge.setSelectize).not.toHaveBeenCalled();
  });

  it("still reads an English level saved before multi-language support", async () => {
    const legacy: Profile = { version: 1, values: { englishLevel: "B2" } };
    await fill(TRAFFIT, legacy);
    expect($<HTMLSelectElement>("#en").value).toBe("432");
  });

  it("leaves a Selectize field alone when the user already picked something", async () => {
    const bridge: MainWorldBridge = {
      readSelectize: vi.fn(async (targets: string[]) => ({
        [targets[0]]: { multiple: false, hasValue: true, options: [{ value: "481", text: "zdalny" }] },
      })),
      setSelectize: vi.fn(async () => 0),
      searchSelectize: vi.fn(async () => null),
    };
    await fill(TRAFFIT, PROFILE, bridge);
    expect(bridge.setSelectize).not.toHaveBeenCalled();
  });
});

describe("Traffit location dropdowns", () => {
  const CITIES: SelectizeInfo = {
    multiple: false,
    hasValue: false,
    options: [
      { value: "c1", text: "Warszawa, mazowieckie, Polska" },
      { value: "c2", text: "Warszawice, mazowieckie, Polska" },
    ],
  };

  function locationBridge(cities: SelectizeInfo = CITIES) {
    const searched: string[] = [];
    const bridge: MainWorldBridge = {
      readSelectize: vi.fn(async () => ({})),
      setSelectize: vi.fn(async (items) => items.length),
      searchSelectize: vi.fn(async (target: string, query: string) => {
        searched.push(`${target === tagOf("#loc") ? "city" : "other"}:${query}`);
        return cities;
      }),
    };
    return { bridge, searched };
  }

  const tagOf = (sel: string) => $(sel).getAttribute("data-job-autofill-target");

  it("searches only the city and picks the matching option", async () => {
    const { bridge, searched } = locationBridge();
    await fill(TRAFFIT, PROFILE, bridge);
    expect(searched).toEqual(["city:Warszawa"]);
    expect(bridge.setSelectize).toHaveBeenCalledWith([{ target: tagOf("#loc"), values: ["c1"] }]);
    expect($("#country").hasAttribute("data-job-autofill-target")).toBe(false);
  });

  it("leaves a city the user already picked", async () => {
    const { bridge } = locationBridge({ ...CITIES, hasValue: true });
    await fill(TRAFFIT, PROFILE, bridge);
    expect(bridge.setSelectize).not.toHaveBeenCalled();
  });

  it("does not search when the profile has no city", async () => {
    const { bridge, searched } = locationBridge();
    await fill(TRAFFIT, { ...PROFILE, values: { ...PROFILE.values, city: "" } }, bridge);
    expect(searched).toEqual([]);
  });
});

describe("city names", () => {
  it("adds the Polish spelling for English names and names typed without ł", () => {
    expect(cityNames("Warsaw")).toEqual(["Warsaw", "Warszawa"]);
    expect(cityNames("Wroclaw")).toEqual(["Wroclaw", "Wrocław"]);
    expect(cityNames("lodz")).toEqual(["lodz", "Łódź"]);
    expect(cityNames("Kraków")).toEqual(["Kraków", "Cracow"]);
    expect(cityNames("Gdynia")).toEqual(["Gdynia"]);
  });
});

describe("chooseLocation", () => {
  const opts = (...texts: string[]) => texts.map((text, i) => ({ value: String(i), text }));

  it("prefers the city itself over villages with the same name", () => {
    const options = [
      { value: "68667", text: "Łódź", details: ["Polska", "Wielkopolskie", "Poznański", "Stęszew"] },
      { value: "10487", text: "Łódź", details: ["Polska", "Łódzkie", "Łódź", "Łódź"] },
    ];
    expect(chooseLocation(["Łódź"], options)?.value).toBe("10487");
  });

  it("prefers an exact name", () => {
    expect(chooseLocation(["Kraków"], opts("Kraków, małopolskie", "Kraków"))?.value).toBe("1");
  });

  it("matches the first part of a longer label", () => {
    expect(chooseLocation(["Łódź"], opts("Łódź, łódzkie, Polska", "Łódzkie"))?.value).toBe("0");
  });

  it("returns nothing for a partial or missing match", () => {
    expect(chooseLocation(["Warsz"], opts("Warszawa"))).toBeNull();
    expect(chooseLocation(["Gdańsk"], opts("Gdynia"))).toBeNull();
  });
});

const radios = (name: string, question: string, answers: string[]) => `
  <div class="question">
    <div class="title">${question} *</div>
    <div class="answers">
      ${answers.map((a, i) => `<label><input type="radio" name="${name}" value="${i}"> ${a}</label>`).join("")}
    </div>
  </div>`;

const RADIO_FORM = `
  <div><div>Imię:*</div><input id="first"></div>
  <div><div>Nazwisko:*</div><input id="last"></div>
  <div><div>Lokalizacja:*</div><textarea id="loc"></textarea></div>
  ${radios("start", "Od kiedy możesz zacząć pracę?", ["natychmiast", "1 tydzień", "2 tygodnie", "1 miesiąc"])}
  <div><div>Podaj oczekiwania finansowe B2B (zł/h netto):*</div><textarea id="rate"></textarea></div>
  ${radios("docker", "Czy znasz Dockera i OpenShift?", ["tak", "nie"])}
`;

describe("generic adapter", () => {
  it("fills radios, textareas, and the hourly salary on an unknown form", async () => {
    await fill(RADIO_FORM);
    expect($<HTMLInputElement>("#first").value).toBe("Daniel");
    expect($<HTMLInputElement>("#last").value).toBe("Kowalski");
    expect($<HTMLTextAreaElement>("#loc").value).toBe("Warszawa");
    expect($<HTMLTextAreaElement>("#rate").value).toBe("120");
    const start = document.querySelector<HTMLInputElement>('input[name="start"]:checked');
    expect(start?.value).toBe("2");
  });

  it("never answers questions it does not understand", async () => {
    await fill(RADIO_FORM);
    expect(document.querySelector('input[name="docker"]:checked')).toBeNull();
  });

  it("skips a radio group the user already answered", async () => {
    document.body.innerHTML = RADIO_FORM;
    document.querySelector<HTMLInputElement>('input[name="start"][value="0"]')!.checked = true;
    const bridge = noMainWorld();
    const actions = await planFills(collectTargets(document, false), PROFILE, bridge);
    expect(actions.some((a) => a.kind === "radio")).toBe(false);
  });
});
