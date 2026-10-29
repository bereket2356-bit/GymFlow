import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import { useData } from "../../context/DataContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { money } from "../../lib/money.js";
import { TODAY, fmtDate, addDaysISO, daysFromToday } from "../../lib/dates.js";
import { PLANS, PLAN_KEYS } from "../../data/packages.js";
import { PHONE_RE } from "../../data/customers.js";
import { currentMembership, customerBalance } from "../../lib/status.js";

function Error({ id, children }) {
  if (!children) return null;
  return (
    <p className="field-error" id={id} role="alert">{children}</p>
  );
}

/** New customer: creates the person plus one starting membership (no payment). */
export function NewCustomerModal({ onClose }) {
  const { addCustomer } = useData();
  const { push } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", planKey: PLAN_KEYS[0], start: TODAY, notes: "" });
  const [errors, setErrors] = useState({});
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter the customer’s full name.";
    if (!PHONE_RE.test(form.phone.trim())) next.phone = "Enter a phone number with at least 7 digits.";
    if (!form.start) next.start = "Choose a start date.";
    setErrors(next);
    const first = ["name", "phone", "start"].find((k) => next[k]);
    if (first) {
      const el = document.getElementById("nc-" + first);
      if (el) el.focus();
      return;
    }
    const customer = await addCustomer({
      name: form.name.trim(),
      phone: form.phone.trim(),
      planKey: form.planKey,
      start: form.start,
      notes: form.notes.trim(),
    });
    onClose();
    if (customer?.id) navigate("/customers/" + customer.id);
    push("Customer " + (customer?.name || form.name.trim()) + " added with a " + PLANS[form.planKey].name + " package.");
  };

  return (
    <Modal
      title="New customer"
      sub="This creates a customer and one starting membership. It does not record a payment."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Create customer</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field span-2">
              <label className="label" htmlFor="nc-name">Full name</label>
              <input
                className={"input" + (errors.name ? " has-error" : "")}
                id="nc-name"
                autoComplete="off"
                data-autofocus
                aria-invalid={errors.name ? "true" : undefined}
                aria-describedby="nc-name-err"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
              <Error id="nc-name-err">{errors.name}</Error>
            </div>
            <div className="field">
              <label className="label" htmlFor="nc-phone">Phone</label>
              <input
                className={"input" + (errors.phone ? " has-error" : "")}
                id="nc-phone"
                autoComplete="off"
                placeholder="+251 911 000 000"
                aria-invalid={errors.phone ? "true" : undefined}
                aria-describedby="nc-phone-err"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
              <Error id="nc-phone-err">{errors.phone}</Error>
            </div>
            <div className="field">
              <label className="label" htmlFor="nc-plan">Starting package</label>
              <select className="select" id="nc-plan" value={form.planKey} onChange={(e) => set({ planKey: e.target.value })}>
                {PLAN_KEYS.map((k) => (
                  <option key={k} value={k}>{PLANS[k].name} — {money(PLANS[k].price)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="nc-start">Start date</label>
              <input
                className={"input" + (errors.start ? " has-error" : "")}
                id="nc-start"
                type="date"
                aria-invalid={errors.start ? "true" : undefined}
                aria-describedby="nc-start-err"
                value={form.start}
                onChange={(e) => set({ start: e.target.value })}
              />
              <Error id="nc-start-err">{errors.start}</Error>
            </div>
            <div className="field">
              <label className="label" htmlFor="nc-notes">
                Notes <span style={{ letterSpacing: 0, textTransform: "none", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                className="input"
                id="nc-notes"
                autoComplete="off"
                placeholder="Anything the owner should remember"
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </div>
          </div>
          <div className="callout callout--muted" style={{ marginTop: 14 }}>
            <span>
              The customer has no account and never signs in. The owner is the only user of this console.
            </span>
          </div>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Create customer</button>
      </form>
    </Modal>
  );
}

/** New membership or renewal: a new record, history is never rewritten. */
export function MembershipModal({ customerId, mode = "new", onClose }) {
  const { customers, addMembership, customerById } = useData();
  const { push } = useToast();
  const isRenew = mode === "renew";
  const list = customers.filter((c) => !c.archived).slice().sort((a, b) => a.name.localeCompare(b.name));
  const fixed = customerId ? customerById(customerId) : null;
  const chosen = fixed || list[0];
  const current = chosen ? currentMembership(chosen) : null;
  const [form, setForm] = useState(() => {
    const planKey = current ? current.plan : PLAN_KEYS[0];
    const start = isRenew && current && daysFromToday(current.end) > 0 ? addDaysISO(current.end, 1) : TODAY;
    return { customerId: chosen ? chosen.id : "", planKey, start, price: PLANS[planKey].price };
  });
  const [errors, setErrors] = useState({});

  if (!chosen) return null;
  const plan = PLANS[form.planKey];
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.start) next.start = "Choose a start date.";
    if (!(Number(form.price) > 0)) next.price = "Enter a price greater than $0.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const targetId = fixed ? fixed.id : form.customerId;
    const target = customerById(targetId);
    await addMembership({
      customerId: targetId,
      planKey: form.planKey,
      start: form.start,
      price: Number(form.price),
    });
    onClose();
    push(
      isRenew
        ? form.start > TODAY
          ? "Renewal scheduled for " + (target?.name || "customer") + " from " + fmtDate(form.start) + "."
          : "Renewal started for " + (target?.name || "customer") + " on " + fmtDate(form.start) + "."
        : plan.name + " added for " + (target?.name || "customer") + ".",
    );
  };

  return (
    <Modal
      title={isRenew ? "Renew membership" : "New membership"}
      sub="A membership records what was sold. No payment is taken here."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{isRenew ? "Create renewal" : "Add membership"}</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field span-2">
              {fixed ? (
                <>
                  <span className="label">Customer</span>
                  <p className="input" style={{ display: "flex", alignItems: "center", background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {fixed.name} <span className="mono" style={{ marginLeft: 8, fontSize: 11 }}>{fixed.id}</span>
                  </p>
                </>
              ) : (
                <>
                  <label className="label" htmlFor="mem-customer">Customer</label>
                  <select
                    className="select"
                    id="mem-customer"
                    value={form.customerId}
                    onChange={(e) => set({ customerId: e.target.value })}
                  >
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} — {c.id}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor="mem-plan">Package</label>
              <select
                className="select"
                id="mem-plan"
                value={form.planKey}
                onChange={(e) => set({ planKey: e.target.value, price: PLANS[e.target.value].price })}
              >
                {PLAN_KEYS.map((k) => (
                  <option key={k} value={k}>{PLANS[k].name} — {money(PLANS[k].price)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="mem-start">Start date</label>
              <input
                className="input"
                id="mem-start"
                type="date"
                data-autofocus
                value={form.start}
                onChange={(e) => set({ start: e.target.value })}
              />
              <p className="field-hint" id="mem-end">
                {fmtDate(addDaysISO(form.start || TODAY, plan.days))} · {plan.days} days
              </p>
            </div>
            <div className="field">
              <label className="label" htmlFor="mem-price">Price</label>
              <input
                className={"input" + (errors.price ? " has-error" : "")}
                id="mem-price"
                inputMode="decimal"
                aria-invalid={errors.price ? "true" : undefined}
                aria-describedby="mem-price-err"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
              />
              <Error id="mem-price-err">{errors.price}</Error>
            </div>
          </div>
          {plan.type === "session" && (
            <p className="field-hint" style={{ marginTop: 10 }}>
              Session pack: {plan.sessions} sessions, valid {plan.days} days from the start date.
            </p>
          )}
          <div className="callout callout--muted" style={{ marginTop: 14 }}>
            <span>
              {isRenew
                ? "A renewal is a new membership record. The current one stays in history."
                : "The new membership starts as Scheduled or Active, depending on the start date. Record any money separately."}
            </span>
          </div>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Submit</button>
      </form>
    </Modal>
  );
}

/** Edit name and phone (owner-only details). */
export function EditCustomerModal({ customerId, onClose }) {
  const { customerById, editCustomer } = useData();
  const { push } = useToast();
  const customer = customerById(customerId);
  const [form, setForm] = useState(() => ({ name: customer ? customer.name : "", phone: customer ? customer.phone : "" }));
  const [errors, setErrors] = useState({});
  if (!customer) return null;

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter a name of at least 2 characters.";
    if (!PHONE_RE.test(form.phone.trim())) next.phone = "Enter a valid phone number.";
    setErrors(next);
    if (Object.keys(next).length) return;
    await editCustomer(customerId, { name: form.name.trim(), phone: form.phone.trim() });
    onClose();
    push("Details updated for " + form.name.trim() + ".");
  };

  return (
    <Modal
      title="Edit customer"
      sub="Name and phone are visible to the owner only."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Save details</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field span-2">
              <label className="label" htmlFor="ec-name">Full name</label>
              <input
                className={"input" + (errors.name ? " has-error" : "")}
                id="ec-name"
                data-autofocus
                aria-invalid={errors.name ? "true" : undefined}
                aria-describedby="ec-name-err"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
              <Error id="ec-name-err">{errors.name}</Error>
            </div>
            <div className="field span-2">
              <label className="label" htmlFor="ec-phone">Phone</label>
              <input
                className={"input" + (errors.phone ? " has-error" : "")}
                id="ec-phone"
                aria-invalid={errors.phone ? "true" : undefined}
                aria-describedby="ec-phone-err"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
              <Error id="ec-phone-err">{errors.phone}</Error>
            </div>
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>
            Private notes are edited on the Overview tab and stay locked to the owner.
          </p>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Save details</button>
      </form>
    </Modal>
  );
}

/** Archive confirmation: destructive, so it states exactly what is kept. */
export function ArchiveModal({ customerId, onClose }) {
  const { customerById, setArchived, payments } = useData();
  const { push } = useToast();
  const customer = customerById(customerId);
  if (!customer) return null;
  const balance = customerBalance(customer, payments);

  return (
    <Modal
      title={"Archive " + customer.name + "?"}
      sub="This hides the customer from the register, dashboard counts and reminders."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              await setArchived(customerId, true);
              onClose();
              push(customer.name + " archived. Nothing was deleted.", "info");
            }}
          >
            Archive customer
          </Button>
        </>
      }
    >
      <div className="modal-body">
        <div className="callout callout--warning">
          <span>
            <strong>Nothing is deleted.</strong> Memberships, payments and private notes stay readable in the archive.
          </span>
        </div>
        <dl className="confirm-list" style={{ marginTop: 14 }}>
          <div className="confirm-row"><dt>Customer</dt><dd className="plain">{customer.name}</dd></div>
          <div className="confirm-row"><dt>Open balance</dt><dd>{money(balance)}</dd></div>
          <div className="confirm-row"><dt>Memberships</dt><dd>{customer.memberships.length}</dd></div>
          <div className="confirm-row">
            <dt>Payments</dt>
            <dd>{payments.filter((p) => p.customerId === customer.id).length}</dd>
          </div>
        </dl>
        {balance > 0 && (
          <p className="note-line" style={{ marginTop: 12 }}>
            An archived customer with an open balance is no longer counted in outstanding totals. Settle it first if
            that matters for this month’s report.
          </p>
        )}
      </div>
    </Modal>
  );
}
