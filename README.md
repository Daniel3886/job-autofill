<p align="center">
  <img src="public/icons/icon128.png" alt="Job Autofill icon" width="96" height="96">
</p>

<h1 align="center">Job Autofill</h1>

<p align="center">
  Fill job application forms with your saved profile in one click.<br>
  A Chromium extension (Manifest V3) for Google Chrome and ungoogled Chromium.
</p>

## What it fills

- **Text fields and textareas:** first name, last name, email, phone, city, province (województwo), country, and salary. A single box for the whole name (Full name, Name, Imię i nazwisko) gets your first and last name, and only when both are saved.
- **Choice questions** (native selects, Selectize dropdowns, radio groups): English level, availability, contract types, work mode, and salary buckets.
- **Province and country dropdowns** labelled Województwo or Kraj (or Province, Country): the option with your saved name is picked. A "woj." or "województwo" prefix on the option is ignored, so "Mazowieckie" matches "woj. mazowieckie". A country saved in one language is also found under its name in another, so "Poland" picks "Polska" and "Deutschland" picks "Niemcy". If two options name the same country, the dropdown is left for you.
- **Traffit city dropdown:** the "Lokalizacja (Miasto)" search box. The extension searches for your saved city and picks the result whose name matches. English city names such as Warsaw, and names typed without ł such as Wroclaw, are looked up by their Polish spelling, and anything after a comma or bracket ("Warszawa, Polska") is ignored. The country dropdown is left as the form set it. When the city is not filled, the page console says why.
- **Start date boxes** (Start date, Available from, Data rozpoczęcia): today plus your saved availability, so "In 2 weeks" fills the date two weeks from now. A native date input always gets it; a text box only when its placeholder shows the format, such as DD.MM.YYYY or RRRR-MM-DD.
- **CV upload:** file inputs labelled CV, resume, or życiorys get your saved CV. Inputs for a cover letter or portfolio are left alone, and so is any input whose `accept` attribute excludes your file type.

A choice is filled only when exactly one option on the page matches your answer. Anything ambiguous, such as "hybrid" on a form with four hybrid options or a salary between two buckets, is left for you. Inputs that already have a value are never overwritten.

Not supported yet: location search dropdowns outside Traffit, drag-and-drop-only upload zones, iframes, yes/no skill questions, and a custom field picker.

## How it works

![Saving a profile on the options page, then filling a job application form with one click](docs/demo-dark.gif)

- **Adapters** identify fields. The first vendor adapter whose `detect()` matches runs, then the generic adapter handles everything it did not claim. To add an ATS, write `src/content/adapters/<vendor>.ts` and add it to `VENDOR_ADAPTERS`.
- **Drivers** put values into controls. Values are set through the native setter, followed by `input` and `change` events, so React and Vue forms register them.
- **Selectize** keeps its options in a page JavaScript object that the isolated content script cannot see. The service worker runs `src/background/mainWorld.ts` in the page's MAIN world to read options and call `setValue`. Only element tags and option ids cross that boundary, plus your city for the location search, since the page sends those to its own server anyway.
- **The CV** is stored in `chrome.storage.local` as base64 under its own key, so reading the profile never loads it. `unlimitedStorage` lifts the 10 MB quota. The content script loads it only when the page has a CV field, then sets it on the input through `DataTransfer`.
- The extension uses `activeTab`, so it can touch a page only after you click the icon on it.

## Saved answers

For questions the extension does not know (e.g. "Czy znasz Dockera i OpenShift?"), save your own answer:

1. On the job form, right-click the extension icon and choose **Pick a field and save an answer**, or press **Alt+Shift+I** (**Option+Shift+I** on a Mac) (change it at `chrome://extensions/shortcuts`).
2. Click a text field. A panel shows the field's question (editable) and an answer box.
3. **Save and fill** stores the answer and fills the field. Esc cancels.

From then on, one click fills any field whose question matches, ignoring case, Polish letters and punctuation. A saved answer never replaces a value from your profile: on a field your profile fills, such as your name or email, the profile wins. A saved answer fills it only while that profile field is empty. Saved answers are listed, editable and removable on the profile page.

## Languages of job forms

Every word the matcher looks for lives in `src/content/locales/`, one JSON file per language (`en.json`, `pl.json`). Write words naturally, with diacritics ("imię", "miejscowość"); they are normalised when loaded. Words from all files are combined, so a form in either language matches.

To support another language, add `src/content/locales/<code>.json` with any of the same sections, import it in `src/content/locales/index.ts`, and add it to `LOCALES`. `npm test` checks that every file only uses known field, option, language and level ids.

Things that do not depend on a language stay in code: HTML `autocomplete` tokens, input types, and CEFR codes such as "C1".

## Development

```sh
npm install
npm test          # matcher unit tests (Vitest + jsdom)
npm run typecheck
npm run build     # outputs dist/
```

Load it: open `chrome://extensions`, turn on Developer mode, click "Load unpacked", and choose `dist/`. After a rebuild, click the reload button on the extension card.

## License

[MIT](LICENSE)
