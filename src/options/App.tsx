import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { CV_ACCEPT, MAX_CV_BYTES, fileToStored, formatSize, type StoredFile } from "../shared/files";
import {
  CHOICE_FIELDS,
  SALARY_FIELDS,
  TEXT_FIELDS,
  getList,
  getText,
  type ChoiceField,
  type Profile,
  type ProfileValue,
} from "../shared/profile";
import { profileStore } from "../shared/profileStore";

type Status = "loading" | "idle" | "saving" | "saved" | "error";

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    profileStore
      .get()
      .then((p) => {
        setProfile(p);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }, []);

  function update(id: string, value: ProfileValue) {
    setProfile((p) => (p ? { ...p, values: { ...p.values, [id]: value } } : p));
    setStatus("idle");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setStatus("saving");
    try {
      await profileStore.save(profile);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  if (!profile) {
    return <main>{status === "error" ? "Could not load your profile." : "Loading…"}</main>;
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

        <CvSection />

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
          <button type="submit" disabled={status === "saving"}>
            Save
          </button>
          <span role="status">
            {status === "saved" && "Saved."}
            {status === "error" && "Something went wrong. Try again."}
          </span>
        </div>
      </form>
    </main>
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

// The CV saves as soon as it is picked, separately from the Save button,
// because it is stored under its own key (see profileStore).
function CvSection() {
  const [cv, setCv] = useState<StoredFile | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    profileStore.getCv().then(setCv, () => setMessage("Could not load your CV."));
  }, []);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // picking the same file again still fires change
    if (!file) return;
    if (file.size > MAX_CV_BYTES) {
      setMessage(`${file.name} is ${formatSize(file.size)}. The limit is ${formatSize(MAX_CV_BYTES)}.`);
      return;
    }
    try {
      const stored = await fileToStored(file);
      await profileStore.saveCv(stored);
      setCv(stored);
      setMessage(`Saved ${stored.name}.`);
    } catch {
      setMessage("Could not save the file. Try again.");
    }
  }

  async function onRemove() {
    await profileStore.removeCv();
    setCv(null);
    setMessage("CV removed.");
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
      {message && (
        <span role="status" className="hint">
          {message}
        </span>
      )}
    </fieldset>
  );
}
