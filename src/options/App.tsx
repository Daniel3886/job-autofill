import { useEffect, useState, type FormEvent } from "react";
import { BUILT_IN_FIELDS, type Profile } from "../shared/profile";
import { profileStore } from "../shared/profileStore";

type Status = "loading" | "idle" | "saving" | "saved" | "error";

const INPUT_TYPES: Record<string, string> = { email: "email", phone: "tel" };

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

  function updateField(id: string, value: string) {
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
        Saved only in this browser. Click the extension icon on a job application form to fill it.
      </p>
      <form onSubmit={onSubmit}>
        {BUILT_IN_FIELDS.map(({ id, label }) => (
          <label key={id}>
            <span>{label}</span>
            <input
              type={INPUT_TYPES[id] ?? "text"}
              value={profile.values[id] ?? ""}
              onChange={(e) => updateField(id, e.target.value)}
            />
          </label>
        ))}
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
