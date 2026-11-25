import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

const EXTENSION = resolve(import.meta.dirname, "..", "dist-e2e");
const FIXTURES = resolve(import.meta.dirname, "fixtures");

// A fake person: the e2e never sees a real profile.
const PROFILE = {
  version: 1,
  values: {
    firstName: "Testowy",
    lastName: "Kandydat",
    email: "kandydat@example.test",
    phone: "+48 500 600 700",
    city: "Warszawa",
    country: "Poland",
    availability: "2w",
    workMode: ["remote"],
    tickRequiredConsent: "yes",
  },
  languages: [{ language: "en", level: "C1" }],
};

let server: Server | undefined;
let origin = "";
let context: BrowserContext | undefined;
let worker: Worker;

test.beforeAll(async () => {
  const listening = createServer(async (req, res) => {
    const name = (req.url ?? "/").split("?")[0].replace(/^\/+/, "");
    if (!/^[\w-]+\.html$/.test(name)) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(resolve(FIXTURES, name));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => listening.listen(0, "127.0.0.1", done));
  server = listening;
  origin = `http://127.0.0.1:${(listening.address() as AddressInfo).port}`;

  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const launched = await chromium.launchPersistentContext("", {
    channel: executablePath ? undefined : "chromium",
    executablePath,
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  context = launched;
  worker = launched.serviceWorkers()[0] ?? (await launched.waitForEvent("serviceworker"));
  await worker.evaluate(async (profile) => {
    // The worker sets up candidate profiles when it is installed. Wait for that, then write the
    // fake profile in the same shape (shared values plus one "Default" profile), in one write,
    // so the setup can never run again in between and replace it with an empty profile.
    for (let i = 0; i < 100 && !(await chrome.storage.local.get("profiles")).profiles; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const profiles = {
      activeId: "default",
      list: [{ id: "default", name: "Default", values: profile.values, languages: profile.languages }],
    };
    await chrome.storage.local.set({ profile, profiles });
  }, PROFILE);
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

/** Opens a fixture and runs the fill the way a toolbar click does: content.js injected into that tab. */
async function fillFixture(name: string): Promise<Page> {
  const page = await context!.newPage();
  await page.goto(`${origin}/${name}`);
  await worker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    if (tab?.id === undefined) throw new Error(`Job Autofill e2e: no tab open at ${url}`);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  }, page.url());
  return page;
}

function inTwoWeeks(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

test("fills a Polish form and leaves traps, optional consents and typed values alone", async () => {
  const page = await fillFixture("polish-form.html");
  await expect(page.locator("#name")).toHaveValue("Testowy Kandydat");
  await expect(page.locator("#email")).toHaveValue("kandydat@example.test");
  await expect(page.locator("#phone")).toHaveValue("+48 500 600 700");
  await expect(page.locator("#country")).toHaveValue("PL");
  await expect(page.locator("#start")).toHaveValue(inTwoWeeks());
  await expect(page.locator("#rodo")).toBeChecked();
  await expect(page.locator("#regulamin")).toBeChecked();

  await expect(page.locator("#trap")).toHaveValue("");
  await expect(page.locator("#future")).not.toBeChecked();
  await expect(page.locator("#city")).toHaveValue("Kraków");
  await page.close();
});

test("fills fields inside an open shadow root", async () => {
  const page = await fillFixture("shadow-form.html");
  const field = (id: string) => page.locator("apply-form").locator(`#${id}`);
  await expect(field("first")).toHaveValue("Testowy");
  await expect(field("last")).toHaveValue("Kandydat");
  await expect(field("first")).toHaveAttribute("data-seen", "yes");
  await expect(field("mail")).toHaveValue("kept@example.com");
  await page.close();
});

test("picks the one matching option in an ARIA combobox and leaves a chosen one", async () => {
  const page = await fillFixture("combobox-form.html");
  await expect(page.locator("#mode")).toHaveText("Remote");
  await expect(page.locator("#mode-list")).toHaveCount(0);
  await expect(page.locator("#lang")).toHaveText("B2");
  await page.close();
});
