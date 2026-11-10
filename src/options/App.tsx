import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { SavedAnswer } from "../shared/answers";
import { CV_ACCEPT, MAX_CV_BYTES, fileToStored, formatSize, type StoredFile } from "../shared/files";
import {
  CHOICE_FIELDS,
  LANGUAGES,
  LANGUAGE_LEVELS,
  LINK_FIELDS,
  LEGACY_SALARY_KEYS,
  SALARY_BASES,
  SALARY_CONTRACTS,
  SALARY_PERIODS,
  TEXT_FIELDS,
  getLanguages,
  getSalaries,
  getList,
  getText,
  type ChoiceField,
  type LanguageSkill,
  type Profile,
  type ProfileValue,
  type SalaryExpectation,
} from "../shared/profile";
import { profileStore } from "../shared/profileStore";
import { HOURS_PER_MONTH, convertAmount, formatAmount, parseAmount } from "../shared/salary";

interface ToastMessage {
  kind: "success" | "error";
  text: string;
}

type ShowToast = (kind: ToastMessage["kind"], text: string) => void;

function isEmpty(value: unknown): boolean {
  return value === "" || (Array.isArray(value) && value.length === 0);
}

function snapshot(profile: Profile, answers: SavedAnswer[]): string {
  const values = Object.fromEntries(
    Object.entries(profile.values)
      .filter(([, v]) => !isEmpty(v))
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify({ ...profile, values, answers });
}

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback<ShowToast>((kind, text) => {
    window.clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "success" ? 2500 : 5000);
  }, []);

  useEffect(() => {
    Promise.all([profileStore.get(), profileStore.getAnswers()])
      .then(([p, a]) => {
        const loaded = { ...p, languages: getLanguages(p), salaries: getSalaries(p) };
        setProfile(loaded);
        setAnswers(a);
        setSavedSnapshot(snapshot(loaded, a));
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const dirty = profile !== null && snapshot(profile, answers) !== savedSnapshot;

  function update(id: string, value: ProfileValue) {
    setProfile((p) => (p ? { ...p, values: { ...p.values, [id]: value } } : p));
  }

  function updateLanguages(languages: LanguageSkill[]) {
    setProfile((p) => (p ? { ...p, languages } : p));
  }

  function updateSalaries(salaries: SalaryExpectation[]) {
    setProfile((p) => (p ? { ...p, salaries } : p));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const values = { ...profile.values };
    for (const key of ["englishLevel", ...LEGACY_SALARY_KEYS.map(([k]) => k)]) delete values[key];
    const languages = (profile.languages ?? []).filter((l) => l.level !== "");
    const salaries = (profile.salaries ?? []).filter((s) => s.amount.trim() !== "");
    try {
      const keptAnswers = answers
        .map((a) => ({ ...a, question: a.question.replace(/\s+/g, " ").trim() }))
        .filter((a) => a.question !== "" && a.answer.trim() !== "");
      await Promise.all([
        profileStore.save({ ...profile, values, languages, salaries }),
        profileStore.saveAnswers(keptAnswers),
      ]);
      setAnswers(keptAnswers);
      setSavedSnapshot(snapshot(profile, keptAnswers));
      showToast("success", "Profile saved");
    } catch {
      showToast("error", "Could not save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return <main>{loadFailed ? "Could not load your profile." : "Loading…"}</main>;
  }

  return (
    <main>
      <h1>Your profile</h1>
      <p className="hint">
        Saved only in this browser. Click the extension icon on a job application form to fill it. Anything left
        empty here, or without an exact match on the form, is left for you to fill.
      </p>
      <form onSubmit={onSubmit}>
        <div className="sections">
          <div className="column">
            <fieldset>
              <legend>Personal details</legend>
              {TEXT_FIELDS.map(({ id, label, inputType }) => (
                <label key={id}>
                  <span>{label}</span>
                  <input type={inputType} value={getText(profile, id)} onChange={(e) => update(id, e.target.value)} />
                </label>
              ))}
            </fieldset>
          </div>

          <div className="column">
            <CvSection showToast={showToast} />

            <fieldset>
              <legend>Preferences</legend>
              {CHOICE_FIELDS.map((field) => (
                <ChoiceInput
                  key={field.id}
                  field={field}
                  value={getList(profile, field.id)}
                  onChange={(v) => update(field.id, v)}
                />
              ))}
            </fieldset>
          </div>

          {/* Three short fields side by side, so Links stays one row tall. */}
          <fieldset className="links-row">
            <legend>Links</legend>
            <p className="hint">Filled into fields that ask for your LinkedIn, GitHub, or portfolio.</p>
            <div className="link-fields">
              {LINK_FIELDS.map(({ id, label, placeholder }) => (
                <label key={id}>
                  <span>{label}</span>
                  <input
                    type="url"
                    placeholder={placeholder}
                    value={getText(profile, id)}
                    onChange={(e) => update(id, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {/* Languages and salary share a row so both start at the same height. */}
          <LanguagesSection languages={profile.languages ?? []} onChange={updateLanguages} />
          <SalarySection salaries={profile.salaries ?? []} onChange={updateSalaries} />

          <div className="answers-row">
            <SavedAnswersSection answers={answers} onChange={setAnswers} />
          </div>
        </div>

        <div className="actions">
          <button type="submit" className="primary" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save profile"}
          </button>
          <span className={`save-status${dirty ? " dirty" : ""}`}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>
      </form>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`toast toast-${toast.kind}`}>
          <span className="toast-icon" aria-hidden="true">
            {toast.kind === "success" ? "✓" : "!"}
          </span>
          <span>{toast.text}</span>
          <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// Enough for real profiles while keeping the page short.
const MAX_LANGUAGES = 5;
const MAX_SALARIES = 5;

function LanguagesSection({
  languages,
  onChange,
}: {
  languages: LanguageSkill[];
  onChange: (languages: LanguageSkill[]) => void;
}) {
  const used = new Set(languages.map((l) => l.language));
  const nextLanguage = LANGUAGES.find((l) => !used.has(l.code));

  function updateRow(index: number, patch: Partial<LanguageSkill>) {
    onChange(languages.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  return (
    <fieldset>
      <legend>Languages</legend>
      <p className="hint">Used when a form asks for your level in a specific language.</p>
      {languages.length === 0 && <p className="empty">No languages added yet.</p>}
      {languages.map((row, index) => (
        <div className="language-row" key={row.language}>
          <label>
            <span>Language</span>
            <select value={row.language} onChange={(e) => updateRow(index, { language: e.target.value })}>
              {LANGUAGES.filter((l) => l.code === row.language || !used.has(l.code)).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Level</span>
            <select value={row.level} onChange={(e) => updateRow(index, { level: e.target.value })}>
              <option value="">Choose level</option>
              {LANGUAGE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => onChange(languages.filter((_, i) => i !== index))}
            aria-label={`Remove ${LANGUAGES.find((l) => l.code === row.language)?.label ?? "language"}`}
          >
            Remove
          </button>
        </div>
      ))}
      {languages.length >= MAX_LANGUAGES ? (
        <p className="limit-note">You can add up to {MAX_LANGUAGES} languages.</p>
      ) : (
        nextLanguage && (
          <button
            type="button"
            className="secondary add"
            onClick={() => onChange([...languages, { language: nextLanguage.code, level: "" }])}
          >
            + Add language
          </button>
        )
      )}
    </fieldset>
  );
}

function ChoiceInput({
  field,
  value,
  onChange,
}: {
  field: ChoiceField;
  value: string[];
  onChange: (v: ProfileValue) => void;
}) {
  if (field.multiple) {
    return (
      <div className="choice">
        <span>{field.label}</span>
        {field.options.map((o) => (
          <label key={o.value} className="check">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  return (
    <label>
      <span>{field.label}</span>
      <select value={value[0] ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not set</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CvSection({ showToast }: { showToast: ShowToast }) {
  const [cv, setCv] = useState<StoredFile | null>(null);

  useEffect(() => {
    profileStore.getCv().then(setCv, () => showToast("error", "Could not load your CV."));
  }, [showToast]);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_CV_BYTES) {
      showToast("error", `${file.name} is ${formatSize(file.size)}. The limit is ${formatSize(MAX_CV_BYTES)}.`);
      return;
    }
    try {
      const stored = await fileToStored(file);
      await profileStore.saveCv(stored);
      setCv(stored);
      showToast("success", `CV saved: ${stored.name}`);
    } catch {
      showToast("error", "Could not save the file. Try again.");
    }
  }

  async function onRemove() {
    await profileStore.removeCv();
    setCv(null);
    showToast("success", "CV removed");
  }

  return (
    <fieldset>
      <legend>CV</legend>
      <p className="hint">Uploaded to file fields that ask for a CV or resume. Saved as soon as you pick it.</p>
      {cv && (
        <div className="file-card">
          <span className="file-badge">{cv.name.split(".").pop()?.toUpperCase()}</span>
          <div className="file-meta">
            <strong>{cv.name}</strong>
            <span>
              {formatSize(cv.size)} · saved {new Date(cv.savedAt).toLocaleDateString()}
            </span>
          </div>
          <button type="button" className="secondary" onClick={onRemove}>
            Remove
          </button>
        </div>
      )}
      <label className="file-pick">
        <span>{cv ? "Replace file" : "Choose file"}</span>
        <input id="cv-file" type="file" accept={CV_ACCEPT} onChange={onPick} />
      </label>
    </fieldset>
  );
}

function SalarySection({
  salaries,
  onChange,
}: {
  salaries: SalaryExpectation[];
  onChange: (salaries: SalaryExpectation[]) => void;
}) {
  const [notes, setNotes] = useState<Record<number, string>>({});

  function updateRow(index: number, patch: Partial<SalaryExpectation>) {
    onChange(salaries.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function setNote(index: number, note: string | null) {
    setNotes((n) => {
      const next = { ...n };
      if (note) next[index] = note;
      else delete next[index];
      return next;
    });
  }

  function changeAmount(index: number, amount: string) {
    updateRow(index, { amount });
    setNote(index, null);
  }

  function changePeriod(index: number, period: SalaryExpectation["period"]) {
    const row = salaries[index];
    const amount = parseAmount(row.amount);
    if (amount === null || period === row.period) {
      updateRow(index, { period });
      return;
    }
    const converted = formatAmount(convertAmount(amount, row.period, period), period);
    updateRow(index, { period, amount: converted });
    const from = SALARY_PERIODS.find((p) => p.value === row.period)?.label;
    setNote(
      index,
      `Converted from ${row.amount} ${from} at ${HOURS_PER_MONTH} working hours a month. Adjust if needed.`,
    );
  }

  function removeRow(index: number) {
    onChange(salaries.filter((_, i) => i !== index));
    setNotes({});
  }

  return (
    <fieldset>
      <legend>Salary expectations (PLN)</legend>
      <p className="hint">
        Filled only when a form asks for the same contract, period, and net or gross as one of your rows.
      </p>
      {salaries.length === 0 && <p className="empty">No salary expectations added yet.</p>}
      {salaries.map((row, index) => (
        <div className="salary-row" key={index}>
          <label className="amount">
            <span>Amount</span>
            <input
              type="text"
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => changeAmount(index, e.target.value)}
            />
          </label>
          <label>
            <span>Contract</span>
            <select
              value={row.contract}
              onChange={(e) => updateRow(index, { contract: e.target.value as SalaryExpectation["contract"] })}
            >
              {SALARY_CONTRACTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Period</span>
            <select
              value={row.period}
              onChange={(e) => changePeriod(index, e.target.value as SalaryExpectation["period"])}
            >
              {SALARY_PERIODS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Net / gross</span>
            <select
              value={row.basis}
              onChange={(e) => updateRow(index, { basis: e.target.value as SalaryExpectation["basis"] })}
            >
              {SALARY_BASES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="secondary" onClick={() => removeRow(index)}>
            Remove
          </button>
          {notes[index] && <p className="row-note">{notes[index]}</p>}
        </div>
      ))}
      {salaries.length >= MAX_SALARIES ? (
        <p className="limit-note">You can add up to {MAX_SALARIES} salary expectations.</p>
      ) : (
        <button
          type="button"
          className="secondary add"
          onClick={() => onChange([...salaries, { amount: "", contract: "b2b", period: "month", basis: "net" }])}
        >
          + Add salary
        </button>
      )}
    </fieldset>
  );
}

function SavedAnswersSection({
  answers,
  onChange,
}: {
  answers: SavedAnswer[];
  onChange: (answers: SavedAnswer[]) => void;
}) {
  // The question decides which form fields an answer fills, so it changes only on Done.
  // One question is edited at a time; draft holds its text until then.
  const [editing, setEditing] = useState<{ index: number; draft: string } | null>(null);

  function updateRow(index: number, patch: Partial<SavedAnswer>) {
    onChange(answers.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function removeRow(index: number) {
    setEditing(null);
    onChange(answers.filter((_, i) => i !== index));
  }

  function finishEditing() {
    if (editing === null || editing.draft.trim() === "") return;
    updateRow(editing.index, { question: editing.draft });
    setEditing(null);
  }

  return (
    <fieldset>
      <legend>
        Saved answers
        {answers.length > 0 && <span className="count">{answers.length}</span>}
      </legend>
      <p className="hint">
        Filled into any form field whose question matches exactly (case, Polish letters and punctuation are ignored). To
        add one, right-click the extension icon on a job form and choose "Pick a field and save an answer", or press
        Alt+Shift+I (Option+Shift+I on a Mac).
      </p>
      {answers.length === 0 ? (
        <p className="empty">No saved answers yet.</p>
      ) : (
        <div className="answer-table" role="table" aria-label="Saved answers">
          <div className="answer-row answer-head" role="row">
            <span role="columnheader">Question</span>
            <span role="columnheader">Answer</span>
            <span role="columnheader" className="visually-hidden">
              Actions
            </span>
          </div>
          {answers.map((row, index) => {
            const question = row.question.trim() || "No question";
            const draft = editing?.index === index ? editing.draft : null;
            return (
              <div
                className={`answer-row${draft === null ? "" : " editing"}`}
                role="row"
                key={`${index}-${row.savedAt}`}
              >
                <div role="cell" className="answer-question">
                  {draft === null ? (
                    question
                  ) : (
                    <div className="question-edit">
                      <textarea
                        rows={2}
                        aria-label="Question"
                        autoFocus
                        value={draft}
                        onChange={(e) => setEditing({ index, draft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditing(null);
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            finishEditing();
                          }
                        }}
                      />
                      <div className="question-edit-buttons">
                        <button type="button" className="secondary" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                        <button type="button" disabled={draft.trim() === ""} onClick={finishEditing}>
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div role="cell" className="answer-value">
                  <input
                    type="text"
                    aria-label={`Answer to: ${question}`}
                    value={row.answer}
                    onChange={(e) => updateRow(index, { answer: e.target.value })}
                  />
                </div>
                <div role="cell" className="answer-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit question: ${question}`}
                    title="Edit question"
                    onClick={() => setEditing({ index, draft: row.question })}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Remove saved answer: ${question}`}
                    title="Remove"
                    onClick={() => removeRow(index)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
