import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CV_ACCEPT, MAX_CV_BYTES, fileToStored, formatSize, type StoredFile } from "../shared/files";
import {
  CHOICE_FIELDS,
  LANGUAGES,
  LANGUAGE_LEVELS,
  SALARY_FIELDS,
  TEXT_FIELDS,
  getLanguages,
  getList,
  getText,
  type ChoiceField,
  type LanguageSkill,
  type Profile,
  type ProfileValue,
} from "../shared/profile";
import { profileStore } from "../shared/profileStore";

interface ToastMessage {
  kind: "success" | "error";
  text: string;
}

type ShowToast = (kind: ToastMessage["kind"], text: string) => void;

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback<ShowToast>((kind, text) => {
    window.clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "success" ? 2500 : 5000);
  }, []);

  useEffect(() => {
    profileStore
      .get()
      .then((p) => setProfile({ ...p, languages: getLanguages(p) }))
      .catch(() => setLoadFailed(true));
  }, []);

  function update(id: string, value: ProfileValue) {
    setProfile((p) => (p ? { ...p, values: { ...p.values, [id]: value } } : p));
  }

  function updateLanguages(languages: LanguageSkill[]) {
    setProfile((p) => (p ? { ...p, languages } : p));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { englishLevel: _legacy, ...values } = profile.values;
    const languages = (profile.languages ?? []).filter((l) => l.level !== "");
    try {
      await profileStore.save({ ...profile, values, languages });
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
        <fieldset>
          <legend>Personal details</legend>
          {TEXT_FIELDS.map(({ id, label, inputType }) => (
            <label key={id}>
              <span>{label}</span>
              <input type={inputType} value={getText(profile, id)} onChange={(e) => update(id, e.target.value)} />
            </label>
          ))}
        </fieldset>

        <CvSection showToast={showToast} />

        <LanguagesSection languages={profile.languages ?? []} onChange={updateLanguages} />

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

        <fieldset>
          <legend>Salary expectations (PLN)</legend>
          <p className="hint">Filled only when the form asks for that exact unit and contract type.</p>
          {SALARY_FIELDS.map(({ id, label }) => (
            <label key={id}>
              <span>{label}</span>
              <input
                type="text"
                inputMode="numeric"
                value={getText(profile, id)}
                onChange={(e) => update(id, e.target.value)}
              />
            </label>
          ))}
        </fieldset>

        <div className="actions">
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
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
      {nextLanguage && (
        <button
          type="button"
          className="secondary add"
          onClick={() => onChange([...languages, { language: nextLanguage.code, level: "" }])}
        >
          + Add language
        </button>
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
              onChange={(e) =>
                onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))
              }
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
