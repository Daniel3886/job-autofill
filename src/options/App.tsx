import { useEffect, useState, type FormEvent } from "react";
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
