import { useState } from "react";
import Icon from "../components/ui/Icon.jsx";
import ArchitectureDiagram from "../components/diagrams/ArchitectureDiagram.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { TZ_LABEL } from "../data/config.js";

/** Owner settings: gym identity, reminder windows and the architecture reference. */
export default function Settings() {
  const { gym, updateGym } = useData();
  const { push } = useToast();

  const [form, setForm] = useState({
    name: gym.name,
    warn7: String(gym.warn7),
    warn3: String(gym.warn3),
    warn1: String(gym.warn1),
    inactive: String(gym.inactive),
  });
  const [errors, setErrors] = useState({});

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    const w7 = parseInt(form.warn7, 10);
    const w3 = parseInt(form.warn3, 10);
    const w1 = parseInt(form.warn1, 10);
    const inactive = parseInt(form.inactive, 10);

    if (form.name.trim().length < 2) next.name = "Enter the gym name.";
    [w7, w3, w1].forEach((v, i) => {
      if (!isFinite(v) || v < 1 || v > 30) {
        next[["warn7", "warn3", "warn1"][i]] = "Use a number between 1 and 30 days.";
      }
    });
    if (isFinite(w7) && isFinite(w3) && isFinite(w1) && !(w7 >= w3 && w3 >= w1)) {
      next.warn7 = "Windows must run from the widest to the tightest: first ≥ second ≥ final.";
    }
    if (!isFinite(inactive) || inactive < 1 || inactive > 90) {
      next.inactive = "Use a number between 1 and 90 days.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    updateGym({
      name: form.name.trim(),
      warn7: w7,
      warn3: w3,
      warn1: w1,
      inactive,
    });
    push("Settings saved. Expiry windows are " + w7 + ", " + w3 + " and " + w1 + " days.");
  };

  const error = (key) =>
    errors[key] ? (
      <p className="field-error" id={"set-" + key + "-err"} role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Settings</h1>
          <p className="page-meta">
            <span>Owner console</span>
            <span className="dot-sep" />
            <span>Changes stay in memory</span>
            <span className="dot-sep" />
            <span>{TZ_LABEL}</span>
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card" aria-labelledby="gym-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="gym-title">Gym details</h2>
              <p className="card-sub">Used across the console and in exported reports.</p>
            </div>
          </div>
          <form onSubmit={submit} noValidate>
            <div className="card-body">
              <div className="form-grid">
                <div className="field span-2">
                  <label className="label" htmlFor="set-name">Gym name</label>
                  <input
                    className={"input" + (errors.name ? " has-error" : "")}
                    id="set-name"
                    value={form.name}
                    aria-invalid={errors.name ? "true" : undefined}
                    aria-describedby={errors.name ? "set-name-err" : undefined}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                  {error("name")}
                </div>
                <div className="field">
                  <label className="label" htmlFor="set-currency">Currency</label>
                  <select className="select" id="set-currency" value="$" readOnly>
                    <option value="$">$ — placeholder</option>
                  </select>
                  <p className="field-hint">One placeholder currency in this build.</p>
                </div>
                <div className="field">
                  <label className="label" htmlFor="set-tz">Timezone</label>
                  <select className="select" id="set-tz" value={TZ_LABEL} readOnly>
                    <option>{TZ_LABEL}</option>
                  </select>
                  <p className="field-hint">All dates and session times use this label.</p>
                </div>
                <div className="field span-2">
                  <span className="label">Date-counting rule</span>
                  <div className="pkg-readonly">
                    <span className="lock-label"><Icon name="lock" />Read-only</span>
                    <p>
                      <strong>{gym.dateCounting}.</strong> Membership expiry is counted from the start date. This
                      release does not allow the rule to be edited.
                    </p>
                  </div>
                </div>
                <div className="field span-2">
                  <span className="label">Expiry warning windows</span>
                  <div className="warn-grid">
                    <div className="field">
                      <label className="field-hint" htmlFor="set-warn7">First warning, days</label>
                      <input
                        className={"input mono" + (errors.warn7 ? " has-error" : "")}
                        id="set-warn7"
                        inputMode="numeric"
                        value={form.warn7}
                        aria-invalid={errors.warn7 ? "true" : undefined}
                        aria-describedby={errors.warn7 ? "set-warn7-err" : undefined}
                        onChange={(e) => set({ warn7: e.target.value })}
                      />
                      {error("warn7")}
                    </div>
                    <div className="field">
                      <label className="field-hint" htmlFor="set-warn3">Second warning, days</label>
                      <input
                        className={"input mono" + (errors.warn3 ? " has-error" : "")}
                        id="set-warn3"
                        inputMode="numeric"
                        value={form.warn3}
                        aria-invalid={errors.warn3 ? "true" : undefined}
                        aria-describedby={errors.warn3 ? "set-warn3-err" : undefined}
                        onChange={(e) => set({ warn3: e.target.value })}
                      />
                      {error("warn3")}
                    </div>
                    <div className="field">
                      <label className="field-hint" htmlFor="set-warn1">Final warning, days</label>
                      <input
                        className={"input mono" + (errors.warn1 ? " has-error" : "")}
                        id="set-warn1"
                        inputMode="numeric"
                        value={form.warn1}
                        aria-invalid={errors.warn1 ? "true" : undefined}
                        aria-describedby={errors.warn1 ? "set-warn1-err" : undefined}
                        onChange={(e) => set({ warn1: e.target.value })}
                      />
                      {error("warn1")}
                    </div>
                  </div>
                  <p className="field-hint" style={{ marginTop: 6 }}>
                    Dashboard reminders use these windows, with the tightest one always winning.
                  </p>
                </div>
                <div className="field">
                  <label className="label" htmlFor="set-inactive">Inactivity window, days</label>
                  <input
                    className={"input mono" + (errors.inactive ? " has-error" : "")}
                    id="set-inactive"
                    inputMode="numeric"
                    value={form.inactive}
                    aria-invalid={errors.inactive ? "true" : undefined}
                    aria-describedby={errors.inactive ? "set-inactive-err" : undefined}
                    onChange={(e) => set({ inactive: e.target.value })}
                  />
                  {error("inactive")}
                  <p className="field-hint">
                    A customer with no visit inside this window gets an internal reminder.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-foot">
              <span className="fine-print">No setting here sends a message to a customer.</span>
              <button className="btn btn-primary" type="submit">Save settings</button>
            </div>
          </form>
        </section>

        <div className="stack">
          <section className="card" aria-labelledby="arch-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="arch-title">How this works</h2>
                <p className="card-sub">System architecture behind the owner console.</p>
              </div>
            </div>
            <div className="card-body">
              <ArchitectureDiagram />
              <p className="chart-caption">
                The browser talks to a small HTTPS API. The backend owns members, memberships, payments and attendance
                in MongoDB. Backups are a separate nightly copy.
              </p>
            </div>
          </section>

          <section className="card" aria-labelledby="about-title">
            <div className="card-head">
              <h2 className="card-title" id="about-title">About this build</h2>
            </div>
            <div className="card-body">
              <ul className="about-list">
                <li>Single-page console; state lives in memory and resets on reload.</li>
                <li>Only the gym owner signs in. Customers have no accounts.</li>
                <li>Payments are recorded manually and never verified by the system.</li>
                <li>Reminders are internal notes — no email, SMS or push is sent.</li>
                <li>Cash received, membership value and outstanding balance are separate figures.</li>
                <li>Corrections are appended to the ledger; nothing financial is deleted.</li>
              </ul>
            </div>
            <div className="card-foot">
              <span className="mono" style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                BGMS · sample build
              </span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}