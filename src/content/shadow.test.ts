import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../shared/profile";
import { collectTargets } from "./adapters";
import { executeActions, planFills, type MainWorldBridge } from "./plan";

const PROFILE: Profile = {
  version: 1,
  values: { firstName: "Daniel", lastName: "Kowalski", email: "daniel@example.com", workMode: ["remote"] },
};

const bridge: MainWorldBridge = {
  readSelectize: vi.fn(async () => ({})),
  setSelectize: vi.fn(async () => 0),
  searchSelectize: vi.fn(async () => null),
};

function mountShadow(html: string, id = "app-form"): ShadowRoot {
  const host = document.createElement("div");
  host.id = id;
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = html;
  return root;
}

async function fillPage() {
  const actions = await planFills(collectTargets(document, false), PROFILE, bridge);
  return executeActions(actions, bridge);
}

describe("forms inside shadow DOM", () => {
  it("fills text fields, aria-labelledby questions and radios inside an open shadow root", async () => {
    document.body.innerHTML = `<label for="outside">Email</label><input id="outside">`;
    const outer = mountShadow(`<span id="ln">Last name</span><div id="inner-host"></div>`);
    const inner = outer.querySelector("#inner-host")!.attachShadow({ mode: "open" });
    inner.innerHTML = `
      <label for="fn">First name</label><input id="fn">
      <div><p>Work mode</p><div>
        <label><input type="radio" name="mode" value="o"> Office</label>
        <label><input type="radio" name="mode" value="r"> Remote</label>
      </div></div>`;
    const ln = document.createElement("input");
    ln.setAttribute("aria-labelledby", "ln");
    outer.append(ln);

    const filled = await fillPage();

    expect(document.querySelector<HTMLInputElement>("#outside")!.value).toBe("daniel@example.com");
    expect(inner.querySelector<HTMLInputElement>("#fn")!.value).toBe("Daniel");
    expect(ln.value).toBe("Kowalski");
    expect(inner.querySelector<HTMLInputElement>('input[value="r"]')!.checked).toBe(true);
    expect(inner.querySelector<HTMLInputElement>('input[value="o"]')!.checked).toBe(false);
    expect(filled).toBe(4);
  });

  it("fires events that reach listeners outside the shadow root", async () => {
    document.body.innerHTML = "";
    const root = mountShadow(`<label for="fn">First name</label><input id="fn">`);
    const seen: string[] = [];
    document.addEventListener("input", () => seen.push("input"));
    await fillPage();
    expect(root.querySelector<HTMLInputElement>("#fn")!.value).toBe("Daniel");
    expect(seen).toContain("input");
  });

  it("leaves the extension's own picker panel alone", async () => {
    document.body.innerHTML = "";
    const root = mountShadow(`<label for="q">First name</label><input id="q">`, "job-autofill-picker");
    expect(await fillPage()).toBe(0);
    expect(root.querySelector<HTMLInputElement>("#q")!.value).toBe("");
  });
});
