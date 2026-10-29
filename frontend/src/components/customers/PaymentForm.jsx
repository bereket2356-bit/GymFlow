import { useMemo, useState } from "react";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import { useData } from "../../context/DataContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { money, parseAmount, toCents } from "../../lib/money.js";
import { TODAY, fmtDate } from "../../lib/dates.js";
import { planOf, memBalance, memPaid, sortedMemberships, openMembershipFor } from "../../lib/status.js";

const METHODS = ["Cash", "Bank transfer", "Card", "Mobile money"];

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p className="field-error" id={id} role="alert">
      {children}
    </p>
  );
}

/**
 * Record payment: a manual entry for money already received.
 * Amount must be > 0 and ≤ the outstanding balance; a confirmation step follows.
 */
export function PaymentModal({ customerId, onClose }) {
  const data = useData();
  const { sel, payments, addPayment } = data;
  const { push } = useToast();

  const list = useMemo(
    () => sel.nonArchived().slice().sort((a, b) => a.name.localeCompare(b.name)),
    [sel],
  );

  const pickCustomer = () => {
    if (customerId && !list.some((c) => c.id === customerId)) customerId = null;
    if (customerId) return customerId;
    const withBalance = list.find((c) => sel.balanceOfCustomer(c) > 0);
    return (withBalance || list[0] || {}).id || "";
  };

  const [step, setStep] = useState("form");
  const [form, setForm] = useState(() => {
    const cid = pickCustomer();
    const c = list.find((x) => x.id === cid);
    const m = openMembershipFor(c, payments);
    const bal = m ? memBalance(m, payments) : 0;
    return {
      customerId: cid,
      amount: bal > 0 ? String(bal) : "",
      date: TODAY,
      method: "Cash",
      ref: "",
    };
  });
  const [errors, setErrors] = useState({});

  const customer = list.find((c) => c.id === form.customerId) || null;
  const target = openMembershipFor(customer, payments);
  const balance = target ? memBalance(target, payments) : 0;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const changeCustomer = (cid) => {
    const c = list.find((x) => x.id === cid);
    const m = openMembershipFor(c, payments);
    const bal = m ? memBalance(m, payments) : 0;
    set({ customerId: cid, amount: bal > 0 ? String(bal) : "" });
    setErrors({});
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    const amount = parseAmount(form.amount);
    if (!customer || customer.archived) next.customer = "Choose a customer from the register.";
    else if (!target || balance <= 0) next.customer = "This customer has no outstanding balance.";
    if (!isFinite(amount) || amount <= 0) next.amount = "Enter an amount greater than $0.";
    else if (target && amount > balance)
      next.amount = "The outstanding balance is " + money(balance) + ". An amount can’t be more than that.";
    if (!form.date) next.date = "Choose the date the money was received.";
    else if (form.date > TODAY) next.date = "A payment date can’t be in the future.";
    setErrors(next);
    const first = ["customer", "amount", "date"].find((k) => next[k]);
    if (first) {
      const el = document.getElementById("pay-" + first);
      if (el) el.focus();
      return;
    }
    setStep("confirm");
  };

  const amount = parseAmount(form.amount);
  const after = isFinite(amount) ? balance - amount : NaN;

  if (step === "confirm") {
    return (
      <Modal
        title="Confirm payment"
        sub="Check the entry before it is written to the ledger."
        onClose={() => setStep("form")}
        footer={
          <>
            <Button onClick={() => setStep("form")}>Back</Button>
            <Button
              variant="primary"
              onClick={() => {
                addPayment({
                  customerId: form.customerId,
                  membershipId: target.id,
                  amount,
                  date: form.date,
                  method: form.method,
                  ref: form.ref.trim(),
                });
                onClose();
                push("Payment of " + money(toCents(amount)) + " recorded for " + customer.name + ".");
              }}
            >
              Record payment
            </Button>
          </>
        }
      >
        <div className="modal-body">
          <dl className="confirm-list">
            <div className="confirm-row"><dt>Customer</dt><dd className="plain">{customer.name}</dd></div>
            <div className="confirm-row"><dt>Applies to</dt><dd className="plain">{planOf(target.plan).name}</dd></div>
            <div className="confirm-row"><dt>Amount</dt><dd>{money(toCents(amount))}</dd></div>
            <div className="confirm-row"><dt>Method</dt><dd className="plain">{form.method}</dd></div>
            <div className="confirm-row"><dt>Date</dt><dd>{fmtDate(form.date)}</dd></div>
            {form.ref.trim() && <div className="confirm-row"><dt>Reference</dt><dd>{form.ref.trim()}</dd></div>}
            <div className="confirm-row confirm-total"><dt>Balance after</dt><dd>{money(Math.max(0, toCents(after)))}</dd></div>
          </dl>
          <div className="callout" style={{ marginTop: 14 }}>
            <span>
              <strong>Manual record.</strong> No card is charged and no bank or mobile-money transfer is checked by
              the system. Only the owner’s confirmation makes this entry.
            </span>
          </div>
        </div>
      </Modal>
    );
  }

  if (!list.length) return null;

  return (
    <Modal
      title="Record payment"
      sub="A manual entry for money already received. Nothing is charged or verified automatically."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Review payment</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field span-2">
              <label className="label" htmlFor="pay-customer">Customer</label>
              <select
                className="select"
                id="pay-customer"
                value={form.customerId}
                aria-describedby={"pay-target" + (errors.customer ? " pay-customer-err" : "")}
                onChange={(e) => changeCustomer(e.target.value)}
              >
                {list.map((c) => {
                  const b = sel.balanceOfCustomer(c);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} — {b > 0 ? money(b) + " due" : "settled"}
                    </option>
                  );
                })}
              </select>
              <p className="field-hint" id="pay-target">
                {target
                  ? planOf(target.plan).name + " · " + fmtDate(target.start) + " – " + fmtDate(target.end)
                  : "No open balance on this account."}
              </p>
              <FieldError id="pay-customer-err">{errors.customer}</FieldError>
            </div>
            <div className="field">
              <label className="label" htmlFor="pay-amount">Amount</label>
              <input
                className={"input" + (errors.amount ? " has-error" : "")}
                id="pay-amount"
                inputMode="decimal"
                value={form.amount}
                placeholder="0"
                data-autofocus
                aria-invalid={errors.amount ? "true" : undefined}
                aria-describedby={"pay-balance-hint" + (errors.amount ? " pay-amount-err" : "")}
                onChange={(e) => set({ amount: e.target.value })}
                onBlur={(e) => set({ amount: e.target.value.trim() ? String(toCents(parseAmount(e.target.value) || 0)) : "" })}
              />
              <p className="field-hint" id="pay-balance-hint">Outstanding on this membership: {money(balance)}</p>
              <FieldError id="pay-amount-err">{errors.amount}</FieldError>
            </div>
            <div className="field">
              <label className="label" htmlFor="pay-date">Date received</label>
              <input
                className={"input" + (errors.date ? " has-error" : "")}
                id="pay-date"
                type="date"
                value={form.date}
                max={TODAY}
                aria-invalid={errors.date ? "true" : undefined}
                aria-describedby={errors.date ? "pay-date-err" : undefined}
                onChange={(e) => set({ date: e.target.value })}
              />
              <FieldError id="pay-date-err">{errors.date}</FieldError>
            </div>
            <div className="field">
              <label className="label" htmlFor="pay-method">Method</label>
              <select className="select" id="pay-method" value={form.method} onChange={(e) => set({ method: e.target.value })}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="pay-ref">
                Reference <span style={{ letterSpacing: 0, textTransform: "none", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                className="input"
                id="pay-ref"
                value={form.ref}
                placeholder="Receipt or transfer number"
                autoComplete="off"
                onChange={(e) => set({ ref: e.target.value })}
              />
            </div>
          </div>
          <div className="callout callout--muted" style={{ marginTop: 14 }}>
            <span>
              Cash received is recorded as a payment. It is not membership value, and it does not settle anything
              until the owner saves it.
            </span>
          </div>
          <div className="chart-frame" style={{ marginTop: 12 }}>
            <p className="label" style={{ fontSize: 10 }}>Balance after payment</p>
            <p style={{ marginTop: 4, fontSize: 15 }}>
              {!isFinite(amount) || amount <= 0 || !target ? (
                <span className="muted">Enter an amount to preview the balance.</span>
              ) : after < 0 ? (
                <span style={{ color: "var(--danger)" }}>{money(after)} — more than the balance</span>
              ) : (
                <>
                  <span className="num" style={{ fontSize: 15, color: after === 0 ? "var(--success)" : undefined }}>
                    {money(after)}
                  </span>
                  {after === 0 && <span className="muted"> · settles the membership</span>}
                </>
              )}
            </p>
          </div>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Review payment</button>
      </form>
    </Modal>
  );
}

/**
 * Log a correction: appends a dated line with a reason. The original payment
 * stays visible — nothing is edited or deleted.
 */
export function CorrectionModal({ customerId, onClose }) {
  const data = useData();
  const { addCorrection } = data;
  const { push } = useToast();
  const customer = data.customerById(customerId);
  const memberships = customer ? sortedMemberships(customer).slice().reverse() : [];
  const [step, setStep] = useState("form");
  const [form, setForm] = useState(() => ({
    membershipId: memberships.length ? memberships[0].id : "",
    amount: "",
    reason: "",
  }));
  const [errors, setErrors] = useState({});

  if (!customer || !memberships.length) return null;
  const membership = memberships.find((m) => m.id === form.membershipId) || memberships[0];
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    const amount = toCents(parseAmount(String(form.amount).replace(/[−–—]/g, "-")));
    const reason = form.reason.trim();
    const next = {};
    if (!isFinite(amount) || amount === 0) next.amount = "Enter a non-zero correction amount.";
    else if (amount < 0 && memPaid(membership, data.payments) + amount < 0)
      next.amount = "A correction can’t take recorded payments below $0.";
    if (reason.length < 4) next.reason = "Add a short reason of at least 4 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setStep("confirm");
    setForm((f) => ({ ...f, parsedAmount: amount }));
  };

  const parsedAmount = toCents(parseAmount(String(form.amount).replace(/[−–—]/g, "-")));

  if (step === "confirm") {
    return (
      <Modal
        title="Confirm correction"
        sub="This is a money-related change and will be logged."
        onClose={() => setStep("form")}
        footer={
          <>
            <Button onClick={() => setStep("form")}>Back</Button>
            <Button
              variant="primary"
              onClick={() => {
                addCorrection({
                  customerId: customer.id,
                  membershipId: membership.id,
                  amount: parsedAmount,
                  reason: form.reason.trim(),
                });
                onClose();
                push("Correction of " + money(parsedAmount) + " logged for " + customer.name + ".");
              }}
            >
              Log correction
            </Button>
          </>
        }
      >
        <div className="modal-body">
          <dl className="confirm-list">
            <div className="confirm-row"><dt>Customer</dt><dd className="plain">{customer.name}</dd></div>
            <div className="confirm-row"><dt>Membership</dt><dd className="plain">{planOf(membership.plan).name}</dd></div>
            <div className="confirm-row"><dt>Correction</dt><dd style={{ color: "var(--danger)" }}>{money(parsedAmount)}</dd></div>
            <div className="confirm-row"><dt>Reason</dt><dd className="plain">{form.reason.trim()}</dd></div>
            <div className="confirm-row confirm-total">
              <dt>Recorded paid after</dt>
              <dd>{money(memPaid(membership, data.payments) + parsedAmount)} of {money(membership.price)}</dd>
            </div>
          </dl>
          <div className="callout callout--warning" style={{ marginTop: 14 }}>
            <span>The original entries are kept. The correction is appended as a separate ledger line.</span>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Log a correction"
      sub="Corrections adjust the recorded amount. The original payment stays in the ledger."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Review correction</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <div className="field">
            <label className="label" htmlFor="cor-membership">Membership</label>
            <select
              className="select"
              id="cor-membership"
              value={membership.id}
              onChange={(e) => set({ membershipId: e.target.value })}
            >
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {planOf(m.plan).name} — {m.start} to {m.end}
                </option>
              ))}
            </select>
            <p className="field-hint" id="cor-paid-hint">
              Paid {money(memPaid(membership, data.payments))} of {money(membership.price)}
            </p>
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="label" htmlFor="cor-amount">Amount</label>
              <input
                className={"input" + (errors.amount ? " has-error" : "")}
                id="cor-amount"
                inputMode="decimal"
                value={form.amount}
                placeholder="e.g. −20 or 15"
                data-autofocus
                aria-invalid={errors.amount ? "true" : undefined}
                aria-describedby={"cor-amount-err"}
                onChange={(e) => set({ amount: e.target.value })}
              />
              <p className="field-hint">
                A negative amount reduces recorded cash; a positive amount adds a missed payment.
              </p>
              <FieldError id="cor-amount-err">{errors.amount}</FieldError>
            </div>
            <div className="field">
              <label className="label" htmlFor="cor-reason">Reason</label>
              <input
                className={"input" + (errors.reason ? " has-error" : "")}
                id="cor-reason"
                value={form.reason}
                placeholder="What was wrong?"
                aria-invalid={errors.reason ? "true" : undefined}
                aria-describedby="cor-reason-err"
                onChange={(e) => set({ reason: e.target.value })}
              />
              <FieldError id="cor-reason-err">{errors.reason}</FieldError>
            </div>
          </div>
          <div className="callout callout--warning" style={{ marginTop: 14 }}>
            <span>
              Nothing is deleted. The correction is appended with today’s date and a reason, and the payments list
              keeps both entries.
            </span>
          </div>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Review correction</button>
      </form>
    </Modal>
  );
}
