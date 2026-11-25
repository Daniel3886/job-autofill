import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { SavedAnswer } from "../shared/answers";
import { CV_ACCEPT, MAX_CV_BYTES, fileToStored, formatSize, type StoredFile } from "../shared/files";
import {
  CHOICE_FIELDS,
  CONSENT_SETTING,
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
import { PROFILE_COUNTRY, activeProfile, isGlobalKey, mergeProfile, splitProfile, type ProfilesState } from "../shared/profiles";
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

interface EditorData {
  state: ProfilesState;
  editingId: string;
  profile: Profile;
  answers: SavedAnswer[];
}

/** The shared values and answers, merged with profile `editId` (default: the one used for filling). */
async function readEditor(editId?: string): Promise<EditorData> {
  const [global, state, answers] = await Promise.all([
    profileStore.getGlobal(),
    profileStore.getProfiles(),
    profileStore.getAnswers(),
  ]);
  const candidate = state.list.find((p) => p.id === editId) ?? activeProfile(state);
  const merged = mergeProfile(global, candidate);
  return {
    state,
    editingId: candidate?.id ?? "",
    profile: { ...merged, languages: getLanguages(merged), salaries: getSalaries(merged) },
    answers,
  };
}

export function App() {
  // The merged view being edited: shared values plus the profile chosen in the profile bar.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<ProfilesState | null>(null);
  const [editingId, setEditingId] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  // What is in storage, so Reset can bring the form back to it.
  const [saved, setSaved] = useState<{ profile: Profile; answers: SavedAnswer[] } | null>(null);
  // Bumped on Reset so sections with their own state (question edits, salary notes) start fresh.
  const [resetCount, setResetCount] = useState(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback<ShowToast>((kind, text) => {
    window.clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "success" ? 2500 : 5000);
  }, []);

  const show = useCallback((data: EditorData) => {
    setProfiles(data.state);
    setEditingId(data.editingId);
    setProfile(data.profile);
    setAnswers(data.answers);
    setSaved({ profile: data.profile, answers: data.answers });
    setResetCount((n) => n + 1);
  }, []);

  /** Shows profile `editId` (default: the one used for filling). */
  async function load(editId?: string) {
    show(await readEditor(editId));
  }

  useEffect(() => {
    readEditor().then(show, () => setLoadFailed(true));
  }, [show]);

  // The icon menu or the shortcut can switch the profile while this page is open.
  useEffect(() => {
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const next = changes.profiles?.newValue as ProfilesState | undefined;
      if (area === "local" && next) setProfiles(next);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const dirty =
    profile !== null && saved !== null && snapshot(profile, answers) !== snapshot(saved.profile, saved.answers);

  function resetChanges() {
    if (!saved) return;
    setProfile(saved.profile);
    setAnswers(saved.answers);
    setResetCount((n) => n + 1);
  }

  function update(id: string, value: ProfileValue) {
    setProfile((p) => (p ? { ...p, values: { ...p.values, [id]: value } } : p));
  }

  function updateLanguages(languages: LanguageSkill[]) {
    setProfile((p) => (p ? { ...p, languages } : p));
  }

  function updateSalaries(salaries: SalaryExpectation[]) {
    setProfile((p) => (p ? { ...p, salaries } : p));
  }

  /** Saves the shared values, the profile being edited and the answers. Returns whether it worked. */
  async function save(): Promise<boolean> {
    if (!profile || !profiles) return false;
    const candidate = profiles.list.find((p) => p.id === editingId);
    if (!candidate) return false;
    setSaving(true);
    const values = { ...profile.values };
    for (const key of ["englishLevel", ...LEGACY_SALARY_KEYS.map(([k]) => k)]) delete values[key];
    const languages = (profile.languages ?? []).filter((l) => l.level !== "");
    const salaries = (profile.salaries ?? []).filter((s) => s.amount.trim() !== "");
    const { own } = splitProfile({ ...profile, values, languages, salaries });
    try {
      const keptAnswers = answers
        .map((a) => ({ ...a, question: a.question.replace(/\s+/g, " ").trim() }))
        .filter((a) => a.question !== "" && a.answer.trim() !== "");
      await profileStore.saveGlobal({ ...profile, values, languages });
      await profileStore.saveProfile({ id: candidate.id, name: candidate.name, ...own });
      await profileStore.saveAnswers(keptAnswers);
      setAnswers(keptAnswers);
      setSaved({ profile, answers: keptAnswers });
      showToast("success", `Profile "${candidate.name}" saved`);
      return true;
    } catch {
      showToast("error", "Could not save your profile. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await save();
  }

  /**
   * Before the page shows another profile: unsaved edits are saved first, or the switch is
   * cancelled. They are never dropped silently.
   */
  async function confirmLeave(): Promise<boolean> {
    if (!dirty) return true;
    const name = profiles?.list.find((p) => p.id === editingId)?.name ?? "this profile";
    if (!window.confirm(`Save your changes to "${name}" first?\n\nOK saves them. Cancel stays on "${name}".`)) {
      return false;
    }
    return save();
  }

  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action();
    } catch {
      showToast("error", failure);
    }
  }

  async function onPickProfile(id: string) {
    if (id === editingId || !(await confirmLeave())) return;
    await run(() => load(id), "Could not open that profile. Reload the page and try again.");
  }

  async function onNewProfile() {
    const name = window.prompt("Name of the new profile, for example “Backend – EN”:")?.trim();
    if (!name || !(await confirmLeave())) return;
    await run(async () => {
      const created = await profileStore.createProfile(name);
      await load(created.id);
      showToast("success", `Profile "${name}" created. Your name, email and phone are already in it.`);
    }, "Could not create the profile. Try again.");
  }

  async function onDuplicateProfile() {
    const current = profiles?.list.find((p) => p.id === editingId);
    if (!current || !(await confirmLeave())) return;
    const name = window.prompt("Name of the copy:", `${current.name} copy`)?.trim();
    if (!name) return;
    await run(async () => {
      const created = await profileStore.createProfile(name, current.id);
      await load(created.id);
      showToast("success", `Copied "${current.name}" to "${name}", CV included`);
    }, "Could not copy the profile. Try again.");
  }

  async function onRenameProfile() {
    const current = profiles?.list.find((p) => p.id === editingId);
    if (!current) return;
    const name = window.prompt("New name:", current.name)?.trim();
    if (!name || name === current.name) return;
    await run(async () => {
      await profileStore.renameProfile(current.id, name);
      setProfiles(await profileStore.getProfiles());
    }, "Could not rename the profile. Try again.");
  }

  async function onDeleteProfile() {
    const current = profiles?.list.find((p) => p.id === editingId);
    if (!current || (profiles?.list.length ?? 0) < 2) return;
    const message = `Delete the profile "${current.name}"?\n\nIts CV, salary, preferences, links and location are removed, including unsaved changes. Your name, email, phone and saved answers stay.`;
    if (!window.confirm(message)) return;
    await run(async () => {
      const next = await profileStore.deleteProfile(current.id);
      await load(next.activeId);
      showToast("success", `Profile "${current.name}" deleted`);
    }, "Could not delete the profile. Try again.");
  }

  async function onUseForFilling() {
    await run(async () => {
      await profileStore.setActive(editingId);
      setProfiles(await profileStore.getProfiles());
    }, "Could not switch the profile used for filling. Try again.");
  }

  if (!profile || !profiles) {
    return <main>{loadFailed ? "Could not load your profile. Reload the page to try again." : "Loading…"}</main>;
  }

  const fillingId = activeProfile(profiles)?.id;

  return (
    <main>
      <h1>Your profile</h1>
      <p className="hint">
        Saved only in this browser. Click the extension icon on a job application form to fill it. Anything left
        empty here, or without an exact match on the form, is left for you to fill.
      </p>
      <section className="profile-bar" aria-label="Candidate profiles">
        <label>
          <span>Editing profile</span>
          <select value={editingId} onChange={(e) => void onPickProfile(e.target.value)} disabled={saving}>
            {profiles.list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === fillingId ? `${p.name} (used for filling)` : p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="profile-actions">
          {editingId === fillingId ? (
            <span className="filling-badge">Used for filling</span>
          ) : (
            <button type="button" className="primary" onClick={() => void onUseForFilling()} disabled={saving}>
              Use for filling
            </button>
          )}
          <button type="button" className="secondary" onClick={() => void onNewProfile()} disabled={saving}>
            New
          </button>
          <button type="button" className="secondary" onClick={() => void onDuplicateProfile()} disabled={saving}>
            Duplicate
          </button>
          <button type="button" className="secondary" onClick={() => void onRenameProfile()} disabled={saving}>
            Rename
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() => void onDeleteProfile()}
            disabled={saving || profiles.list.length < 2}
            title={profiles.list.length < 2 ? "The last profile cannot be deleted" : undefined}
          >
            Delete
          </button>
        </div>
        <p className="hint">
          Each profile has its own CV, city, region, preferences and salary, and can use its own country. Name,
          contact details, links, languages and the default country are shared. Switch the profile used for filling
          from the extension icon's right-click menu, or with Alt+Shift+P.
        </p>
      </section>
      <form onSubmit={onSubmit}>
        <div className="sections">
          <div className="column">
            <fieldset>
              <legend>Personal details</legend>
              <p className="hint">Shared by all profiles.</p>
              {TEXT_FIELDS.filter(({ id }) => isGlobalKey(id)).map(({ id, label, inputType }) => (
                <label key={id}>
                  <span>{id === "country" ? "Country (default)" : label}</span>
                  <input type={inputType} value={getText(profile, id)} onChange={(e) => update(id, e.target.value)} />
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Location</legend>
              <p className="hint">For this profile.</p>
              {TEXT_FIELDS.filter(({ id }) => !isGlobalKey(id)).map(({ id, label, inputType }) => (
                <label key={id}>
                  <span>{label}</span>
                  <input type={inputType} value={getText(profile, id)} onChange={(e) => update(id, e.target.value)} />
                </label>
              ))}
              <label>
                <span>Country for this profile</span>
                <input
                  type="text"
                  placeholder={getText(profile, "country") ? `Default: ${getText(profile, "country")}` : "Uses the default"}
                  value={getText(profile, PROFILE_COUNTRY)}
                  onChange={(e) => update(PROFILE_COUNTRY, e.target.value)}
                />
              </label>
              <p className="hint">Leave empty to use the default country.</p>
            </fieldset>
          </div>

          <div className="column">
            <CvSection key={editingId} profileId={editingId} showToast={showToast} />

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
              <label className="check">
                <input
                  type="checkbox"
                  checked={getText(profile, CONSENT_SETTING) === "yes"}
                  onChange={(e) => update(CONSENT_SETTING, e.target.checked ? "yes" : "")}
                />
                Tick required consent and terms boxes
              </label>
              <p className="hint">
                Only boxes the form marks as required: data processing, privacy policy, terms or regulamin. Marketing,
                newsletter, talent-pool and future-recruitment boxes are never ticked. This setting is shared by all
                profiles.
              </p>
            </fieldset>
          </div>

          {/* Three short fields side by side, so Links stays one row tall. */}
          <fieldset className="links-row">
            <legend>Links</legend>
            <p className="hint">Shared by all profiles. Filled into fields that ask for your LinkedIn, GitHub, or portfolio.</p>
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
          <SalarySection key={resetCount} salaries={profile.salaries ?? []} onChange={updateSalaries} />

          <div className="answers-row">
            <SavedAnswersSection key={resetCount} answers={answers} onChange={setAnswers} />
          </div>
        </div>

        <div className="actions">
          <span className={`save-status${dirty ? " dirty" : ""}`}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button type="submit" className="primary" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save profile"}
          </button>
          <button type="button" className="secondary" disabled={saving || !dirty} onClick={resetChanges}>
            Reset changes
          </button>
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
      <p className="hint">Shared by all profiles.</p>
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

function CvSection({ profileId, showToast }: { profileId: string; showToast: ShowToast }) {
  const [cv, setCv] = useState<StoredFile | null>(null);

  useEffect(() => {
    profileStore.getCv(profileId).then(setCv, () => showToast("error", "Could not load the CV of this profile."));
  }, [profileId, showToast]);

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
      await profileStore.saveCv(stored, profileId);
      setCv(stored);
      showToast("success", `CV saved: ${stored.name}`);
    } catch {
      showToast("error", "Could not save the file. Try again.");
    }
  }

  async function onRemove() {
    await profileStore.removeCv(profileId);
    setCv(null);
    showToast("success", "CV removed");
  }

  return (
    <fieldset>
      <legend>CV</legend>
      <p className="hint">
        Uploaded to file fields that ask for a CV or resume. Each profile has its own. Saved as soon as you pick it.
      </p>
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
