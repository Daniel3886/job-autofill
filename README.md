# Job Autofill

A Chromium extension (Manifest V3) that fills job application forms with your saved profile when you click its icon. It works in Google Chrome and ungoogled Chromium.

## What v1 fills

First name, last name, email, phone, city, and salary expectation, when they are plain text inputs. Labels are recognised in English and Polish. Dropdowns, file uploads (CV), iframes, and a custom field picker are planned for later.

## How it works

```
Options page (React) ──save──▶ chrome.storage.local (src/shared/profileStore.ts)
                                         ▲
Icon click ──▶ service worker ──inject──▶ content script in the active tab
               (src/background)           (src/content) scores inputs and fills them
```

- The extension uses `activeTab`, so it can touch a page only after you click the icon on it.
- `src/content/matcher.ts` scores each input against each field using its `autocomplete` attribute, input type, label, `aria-label`, `name`/`id`, placeholder, and nearby text. The rules per field are in `src/content/fieldRules.ts`.
- Inputs that already have a value are skipped, so clicking twice never overwrites what you typed.
- Values are set through the native setter, followed by `input` and `change` events, so React and Vue forms register them.

## Development

```sh
npm install
npm test          # matcher unit tests (Vitest + jsdom)
npm run typecheck
npm run build     # outputs dist/
```

Load it: open `chrome://extensions`, turn on Developer mode, click "Load unpacked", and choose `dist/`. After a rebuild, click the reload button on the extension card.
