# Job Autofill

A Chromium extension (Manifest V3) that fills job application forms with your saved profile when you click its icon. It works in Google Chrome and ungoogled Chromium.

## What it fills

- **Text fields and textareas:** first name, last name, email, phone, city, and salary.
- **Choice questions** (native selects, Selectize dropdowns, radio groups): English level, availability, contract types, work mode, and salary buckets.

A choice is filled only when exactly one option on the page matches your answer. Anything ambiguous, such as "hybrid" on a form with four hybrid options or a salary between two buckets, is left for you. Inputs that already have a value are never overwritten.

Not supported yet: country/city search dropdowns, CV upload, iframes, yes/no skill questions, and a custom field picker.

## How it works

```
Options page (React) ──save──▶ chrome.storage.local (src/shared/profileStore.ts)
                                         ▲
Icon click ──▶ service worker ──inject──▶ content script in the active tab
               (src/background)               │
                    ▲                         ├─ adapters/  which element is which field
                    │ MAIN world calls        │    traffit.ts  (data-sid, Selectize selects)
                    └──── (Selectize only) ───┤    generic.ts  (scoring matcher, any site)
                                              ├─ choices/   profile answer ↔ option text
                                              ├─ plan.ts    decide what to fill
                                              └─ drivers/   text, select, radio
```

- **Adapters** identify fields. The first vendor adapter whose `detect()` matches runs, then the generic adapter handles everything it did not claim. To add an ATS, write `src/content/adapters/<vendor>.ts` and add it to `VENDOR_ADAPTERS`.
- **Drivers** put values into controls. Values are set through the native setter, followed by `input` and `change` events, so React and Vue forms register them.
- **Selectize** keeps its options in a page JavaScript object that the isolated content script cannot see. The service worker runs `src/background/mainWorld.ts` in the page's MAIN world to read options and call `setValue`. Only element tags and option ids cross that boundary, never profile data.
- The extension uses `activeTab`, so it can touch a page only after you click the icon on it.

## Development

```sh
npm install
npm test          # matcher unit tests (Vitest + jsdom)
npm run typecheck
npm run build     # outputs dist/
```

Load it: open `chrome://extensions`, turn on Developer mode, click "Load unpacked", and choose `dist/`. After a rebuild, click the reload button on the extension card.
