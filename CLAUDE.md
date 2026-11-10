# Engineering standards

The README explains what the extension does and how it is built. This file is the set of rules every change must follow.

## Checks before every PR

All four must pass:

```
npm run typecheck
npm run lint
npm test
npm run build
```

The linter is oxlint (`.oxlintrc.json`). ESLint's TypeScript parser does not support TypeScript 7. Do not silence a rule inline; if a rule does not fit the codebase, change it in `.oxlintrc.json` and say why in the commit message.

## Autofill rules

- A field resolves to exactly one value. If the profile covers a field (name, surname, email, ...), nothing else may fill it with a different value, including a saved answer from the field picker.
- The field picker works on input fields only. Its saved answers add to the built-in defaults and never replace them.
- Never overwrite an input that already has a value.
- Fill a choice (select, radio group, Selectize) only when exactly one option matches. Otherwise leave it for the user.
- Salary values are never converted between periods, contracts, or net and gross.
- Matching changes must not widen what gets filled without a test showing the new case and the cases that must stay untouched.

## Tests

- Every change to autofill behaviour gets a Vitest test that shows what is filled and what is left alone.
- Bug fixes start with a test that fails without the fix.
- Tests run in jsdom with local, deterministic DOM fixtures. No network, no real browser in `npm test`.

## Error messages

- Console messages start with `Job Autofill:`, name the field or step, and say why.
- Use `console.info` for a field that was deliberately skipped and `console.warn` for something that failed.
- Errors shown on the options page say what went wrong and what the user can do about it.
- Never log profile values other than the one needed to explain the problem (for example, the city that was searched).

## Self-review before opening a PR

Read the full diff and check:

- Unhandled errors and rejected promises, especially across the service worker, content script and MAIN world boundary.
- Edge cases: empty profile, missing label, the same element matched twice, a field that already has a value.
- Functions passed to `executeScript` (`src/background/mainWorld.ts`) stay self-contained.
- Storage is accessed only through `src/shared/profileStore.ts`.
- A test covers the change.

Fix what you find before opening the PR, and mention anything left open in the PR description.

## Commits

- One commit per requested change, with a conventional prefix: `feat(scope):`, `fix(scope):`, `chore:`, `docs:`, `test:`.
- The subject says what changed; the body says why when it is not obvious.
- Stage files by path. Never `git add -A` or `git add .`.
- Commits use the author's GitHub noreply address, never a personal email.
- Keep the `Co-Authored-By: Claude ...` trailer on commits Claude makes. Do not add a co-author line for the repository owner.
- History must read clearly on `main`: no "wip" or "fix typo" commits left in a PR.

## Pull requests

- One PR per feature, branched from `main` (or stacked on the PR below it).
- The description lists the key things the PR implements, anything deliberately left out, and which checks ran.
- No "Generated with Claude Code" line or similar in the description.
- Do not merge unless asked. When asked, merge locally with `git merge --no-ff` so the merge commit uses the noreply address, then push.
