import { useRef, useState } from "react";
import SidePanel from "../ui/SidePanel.jsx";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";
import MembershipPreview from "../diagrams/MembershipPreview.jsx";
import { useData } from "../../context/DataContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { formatOnBlur, toCents } from "../../lib/money.js";

const EMPTY = { id: null, name: "", description: "", type: "", validity: { n: 1, unit: "months" }, sessions: null, price: "", active: true };

const hasTime = (d) => d.type === "time" || d.type === "both";
const hasSessions = (d) => d.type === "session" || d.type === "both";

function comparable(d) {
  return {
    name: String(d.name || "").trim(),
    description: String(d.description || "").trim(),
    type: d.type,
    validity: hasTime(d) ? { n: String(d.validity && d.validity.n), unit: d.validity && d.validity.unit } : null,
    sessions: hasSessions(d) ? String(d.sessions == null ? "" : d.sessions) : null,
    price: String(d.price || "").trim(),
    active: !!d.active,
  };
}

function formErrors(draft, packages) {
  const errors = {};
  const name = String(draft.name || "").trim();
  if (name.length < 2) errors.name = "Enter a package name of 2 to 60 characters.";
  else if (name.length > 60) errors.name = "Use 60 characters or fewer.";
  else if (packages.some((p) => p.id !== draft.id && p.name.trim().toLowerCase() === name.toLowerCase()))
    errors.name = "A package with this name already exists.";
  if (String(draft.description || "").length > 240) errors.description = "Shorten the description to 240 characters or fewer.";
  if (!["time", "session", "both"].includes(draft.type)) errors.type = "Choose a package type.";
  if (hasTime(draft)) {
    const n = Number(draft.validity && draft.validity.n);
    if (!isFinite(n) || Math.floor(n) !== n || n < 1 || n > 365) errors.validity = "Use a whole number from 1 to 365.";
    if (!draft.validity || !["days", "weeks", "months", "years"].includes(draft.validity.unit))
      errors.validity = "Choose a validity unit.";
  }
  if (hasSessions(draft)) {
    const n = Number(draft.sessions);
    if (String(draft.sessions == null ? "" : draft.sessions).trim() === "" || !isFinite(n) || Math.floor(n) !== n || n < 1 || n > 500)
      errors.sessions = "Use a whole number from 1 to 500.";
  }
  const price = Number(draft.price);
  if (String(draft.price == null ? "" : draft.price).trim() === "" || !isFinite(price) || price < 0)
    errors.price = "Enter a price of 0 or more.";
  return errors;
}

function Error({ children }) {
  if (!children) return null;
  return (
    <p className="field-error" role="alert">{children}</p>
  );
}

/**
 * Create or edit a package. Save stays disabled until the form is valid, type
 * and session changes on a package with members need a confirmation, and
 * closing with unsaved edits asks before discarding. Packages are never deleted.
 */
export default function PackageForm({ pkg, onClose }) {
  const { packages, upsertPackage, sel } = useData();
  const { push } = useToast();

  const [draft, setDraft] = useState(() =>
    pkg
      ? {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || "",
          type: pkg.type,
          validity: pkg.validity ? { ...pkg.validity } : { n: 1, unit: "months" },
          sessions: pkg.sessions,
          price: Number(pkg.price).toFixed(2),
          active: !!pkg.active,
        }
      : { ...EMPTY, validity: { ...EMPTY.validity } },
  );
  const initial = useRef(JSON.parse(JSON.stringify(draft)));
  const saved = useRef(pkg ? { type: pkg.type, sessions: pkg.sessions } : { type: "", sessions: null });
  const [termsApproved, setTermsApproved] = useState(null);
  const [touched, setTouched] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [dialog, setDialog] = useState(null); // 'discard' | 'type' | 'sessions' | 'terms'
  const [pendingType, setPendingType] = useState(null);

  const errors = formErrors(draft, packages);
  const valid = Object.keys(errors).length === 0;
  const stats = pkg ? sel.packageStats(pkg.id) : { active: 0, total: 0, names: [] };
  const dirty = JSON.stringify(comparable(draft)) !== JSON.stringify(comparable(initial.current));
  const membersExist = stats.total > 0;
  const termsKey = draft.type + "|" + (hasSessions(draft) ? String(draft.sessions == null ? "" : draft.sessions) : "");
  const termsChanged = pkg && (draft.type !== saved.current.type || (hasSessions(draft) && Number(draft.sessions) !== Number(saved.current.sessions)));

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));
  const showError = (key) => ((showAll || touched[key]) && errors[key]) || null;

  const requestClose = () => {
    if (dirty) setDialog("discard");
    else onClose();
  };

  const changeType = (value) => {
    touch("type");
    const apply = () => {
      set({ type: value });
      if (value !== "session") setTermsApproved(termsKeyFor(value, draft.sessions));
      else setTermsApproved(null);
      setDialog(null);
    };
    if (membersExist && value !== draft.type) {
      setPendingType(value);
      setDialog("type");
    } else apply();
  };

  function termsKeyFor(type, sessions) {
    return type + "|" + (type === "session" || type === "both" ? String(sessions == null ? "" : sessions) : "");
  }

  const changeSessions = (value) => {
    touch("sessions");
    set({ sessions: value === "" ? null : value });
  };

  const confirmSessions = () => {
    if (membersExist && hasSessions(draft) && Number(draft.sessions) !== Number(saved.current.sessions)) setDialog("sessions");
  };

  const save = async () => {
    if (!valid) {
      setShowAll(true);
      const first = ["name", "description", "type", "validity", "sessions", "price"].find((k) => errors[k]);
      const map = { name: "pkg-name", description: "pkg-desc", type: "pkg-type", validity: "pkg-validity-n", sessions: "pkg-sessions", price: "pkg-price" };
      const el = document.getElementById(map[first] || "");
      if (el) el.focus();
      return;
    }
    if (termsChanged && stats.active > 0 && termsApproved !== termsKey) {
      setDialog("terms");
      return;
    }
    await upsertPackage({
      id: draft.id || "__new__",
      name: String(draft.name).trim(),
      description: String(draft.description || "").trim(),
      type: draft.type,
      validity: hasTime(draft) ? { n: Number(draft.validity.n), unit: draft.validity.unit } : null,
      sessions: hasSessions(draft) ? Number(draft.sessions) : null,
      price: toCents(Number(draft.price)),
      active: !!draft.active,
    });
    const name = String(draft.name).trim();
    onClose();
    push("Package ‘" + name + "’ saved.");
  };

  const validityCopy = (() => {
    const n = Number(draft.validity && draft.validity.n);
    if (!hasTime(draft)) return null;
    if (!isFinite(n) || n < 1 || n > 365) return "Enter a validity period to see the expiry rule.";
    return (
      "Valid for " +
      n +
      (n === 1 ? " " : " ") +
      String(draft.validity.unit).replace(/s$/, "") +
      (n === 1 ? "" : "s") +
      ". Expiry is calculated from the start date using the gym’s counting rule."
    );
  })();

  return (
    <>
      <SidePanel
        title={pkg ? "Edit package" : "New package"}
        sub={pkg ? draft.name + " · changes apply to new memberships only." : "Price and terms for new memberships."}
        onClose={requestClose}
        footer={
          <div className="pkg-panel-foot">
            <p className="pkg-foot-note">Nothing is deleted. Existing memberships keep their terms.</p>
            <Button onClick={requestClose}>Cancel</Button>
            <Button variant="primary" className="btn-save" disabled={!valid} onClick={save}>
              Save package
            </Button>
          </div>
        }
      >
        <form className="pkg-form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          {stats.active > 0 && (
            <div className="pkg-notice" role="note">
              <span><Icon name="lock" /></span>
              <p>
                Changes apply to new memberships only. <strong>{stats.active} active {stats.active === 1 ? "membership keeps" : "memberships keep"} their original terms.</strong>
              </p>
            </div>
          )}
          {membersExist && stats.active === 0 && (
            <div className="pkg-notice" role="note">
              <span><Icon name="info" /></span>
              <p>This package has historical memberships but no active ones. Existing records keep their original terms.</p>
            </div>
          )}

          <div className="field">
            <div className="pkg-label-row">
              <label className="label" htmlFor="pkg-name">Package name</label>
              <span className="pkg-char">Required</span>
            </div>
            <input
              className={"input" + (showError("name") ? " has-error" : "")}
              id="pkg-name"
              value={draft.name}
              autoComplete="off"
              maxLength={60}
              data-autofocus
              aria-invalid={showError("name") ? "true" : undefined}
              aria-describedby="pkg-name-hint pkg-name-err"
              onChange={(e) => { set({ name: e.target.value }); touch("name"); }}
            />
            <p className="field-hint" id="pkg-name-hint">2 to 60 characters. Names must be unique.</p>
            <p className="field-error" id="pkg-name-err" role="alert">{showError("name")}</p>
          </div>

          <div className="field">
            <div className="pkg-label-row">
              <label className="label" htmlFor="pkg-desc">Description</label>
              <span className={"pkg-char" + (String(draft.description || "").length > 240 ? " is-over" : "")} id="pkg-desc-count">
                {String(draft.description || "").length} / 240
              </span>
            </div>
            <textarea
              className={"textarea" + (showError("description") ? " has-error" : "")}
              id="pkg-desc"
              rows={3}
              value={draft.description}
              aria-invalid={showError("description") ? "true" : undefined}
              aria-describedby="pkg-desc-hint pkg-desc-err"
              onChange={(e) => { set({ description: e.target.value }); touch("description"); }}
            />
            <p className="field-hint" id="pkg-desc-hint">Optional. Shown to the owner in this catalogue only.</p>
            <p className="field-error" id="pkg-desc-err" role="alert">{showError("description")}</p>
          </div>

          <fieldset className="field pkg-type-set" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 6 }}>Package type</legend>
            <div className="pkg-type-grid" id="pkg-type" aria-describedby="pkg-type-err">
              {[
                ["time", "Time-based", "Runs for a set period"],
                ["session", "Session-based", "A fixed session allowance"],
                ["both", "Both", "A period and an allowance"],
              ].map(([key, title, sub]) => (
                <label className={"pkg-type" + (draft.type === key ? " is-checked" : "")} key={key}>
                  <input
                    type="radio"
                    name="pkg-type"
                    value={key}
                    checked={draft.type === key}
                    onChange={() => changeType(key)}
                  />
                  <span className="pt-title">{title}</span>
                  <span className="pt-sub">{sub}</span>
                </label>
              ))}
            </div>
            <p className="field-error" id="pkg-type-err" role="alert">{showError("type")}</p>
          </fieldset>

          <div className={"field" + (hasTime(draft) ? "" : " is-hidden")}>
            <label className="label" htmlFor="pkg-validity-n">Validity period</label>
            <div className="pkg-inline">
              <input
                className={"input mono" + (showError("validity") ? " has-error" : "")}
                id="pkg-validity-n"
                type="number"
                min="1"
                max="365"
                step="1"
                value={draft.validity && draft.validity.n != null ? draft.validity.n : ""}
                aria-invalid={showError("validity") ? "true" : undefined}
                aria-describedby="pkg-validity-copy pkg-validity-err"
                onChange={(e) => { set({ validity: { ...(draft.validity || {}), n: e.target.value } }); touch("validity"); }}
              />
              <select
                className="select"
                id="pkg-validity-unit"
                aria-label="Validity unit"
                value={draft.validity ? draft.validity.unit : "months"}
                onChange={(e) => { set({ validity: { ...(draft.validity || {}), unit: e.target.value } }); touch("validity"); }}
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
            <p className="field-hint" id="pkg-validity-copy">{validityCopy}</p>
            <p className="field-error" id="pkg-validity-err" role="alert">{showError("validity")}</p>
          </div>

          <div className={"field" + (hasSessions(draft) ? "" : " is-hidden")}>
            <label className="label" htmlFor="pkg-sessions">Session allowance</label>
            <input
              className={"input mono" + (showError("sessions") ? " has-error" : "")}
              id="pkg-sessions"
              type="number"
              min="1"
              max="500"
              step="1"
              value={draft.sessions == null ? "" : draft.sessions}
              aria-invalid={showError("sessions") ? "true" : undefined}
              aria-describedby="pkg-sessions-hint pkg-sessions-err"
              onChange={(e) => changeSessions(e.target.value)}
              onBlur={confirmSessions}
            />
            <p className="field-hint" id="pkg-sessions-hint">Whole sessions from 1 to 500. Each attendance deducts one.</p>
            <p className="field-error" id="pkg-sessions-err" role="alert">{showError("sessions")}</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="pkg-price">Price</label>
            <div className="pkg-money">
              <span className="cur" aria-hidden="true">$</span>
              <input
                className={"input mono" + (showError("price") ? " has-error" : "")}
                id="pkg-price"
                inputMode="decimal"
                value={draft.price}
                placeholder="0.00"
                aria-invalid={showError("price") ? "true" : undefined}
                aria-describedby="pkg-price-hint pkg-price-err"
                onChange={(e) => { set({ price: e.target.value }); touch("price"); }}
                onBlur={(e) => { set({ price: formatOnBlur(e.target.value) }); touch("price"); }}
              />
            </div>
            <p className="field-hint" id="pkg-price-hint">Amount charged for the package. Formatting is fixed at two decimals.</p>
            <p className="field-error" id="pkg-price-err" role="alert">{showError("price")}</p>
          </div>

          <div className="pkg-readonly">
            <span className="lock-label"><Icon name="lock" />Counting rule</span>
            <p>
              <strong>Start date counts as day one.</strong> Expiry is counted from the start date. This rule is
              configured in Settings and is read-only in this release.
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="pkg-active">Status</label>
            <select className="select" id="pkg-active" value={draft.active ? "true" : "false"} onChange={(e) => set({ active: e.target.value === "true" })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <p className="field-hint">
              Deactivating prevents new assignments but does not change existing memberships or historical reports.
            </p>
          </div>

          <div className="pkg-preview-box">
            <div className="pkg-preview-kicker">
              <span className="label">Membership preview</span>
              <span className="mono">Live</span>
            </div>
            <MembershipPreview draft={draft} />
          </div>
        </form>
      </SidePanel>

      {dialog === "discard" && (
        <Modal
          title="Discard unsaved changes?"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>Keep editing</Button>
              <Button variant="danger" onClick={onClose}>Discard changes</Button>
            </>
          }
        >
          <div className="modal-body">
            <div className="confirm-block">
              <p>Your edits to this package will be lost. The package catalogue stays unchanged.</p>
            </div>
          </div>
        </Modal>
      )}

      {dialog === "type" && (
        <Modal
          title="Change the package type?"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  set({ type: pendingType });
                  if (pendingType !== "session") setTermsApproved(pendingType + "|" + (pendingType === "both" ? String(draft.sessions == null ? "" : draft.sessions) : ""));
                  setPendingType(null);
                  setDialog(null);
                }}
              >
                Change type
              </Button>
            </>
          }
        >
          <div className="modal-body">
            <div className="confirm-block">
              <p>
                Existing memberships keep the type they were sold. The new type applies to new memberships only.
                {stats.active > 0 && <> <strong>{stats.active} active {stats.active === 1 ? "membership" : "memberships"}</strong> are affected by name: {stats.names.join(", ")}.</>}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {dialog === "sessions" && (
        <Modal
          title="Change the session allowance?"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setTermsApproved(draft.type + "|" + String(draft.sessions == null ? "" : draft.sessions));
                  setDialog(null);
                }}
              >
                Use new allowance
              </Button>
            </>
          }
        >
          <div className="modal-body">
            <div className="confirm-block">
              <p>
                Existing memberships keep their original terms. Only new memberships use the new allowance.
                {stats.active > 0 && <> Affected active members: {stats.names.join(", ")}.</>}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {dialog === "terms" && (
        <Modal
          title="Confirm the new terms"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setTermsApproved(termsKey);
                  setDialog(null);
                  setTimeout(save, 0);
                }}
              >
                Save new terms
              </Button>
            </>
          }
        >
          <div className="modal-body">
            <div className="confirm-block">
              <p>
                This package has <strong>{stats.active} active {stats.active === 1 ? "membership" : "memberships"}</strong>.
                Changing the type or session allowance applies to new memberships only. Existing memberships keep their
                original terms.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}