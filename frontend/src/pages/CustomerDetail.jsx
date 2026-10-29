import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CustomerHeader from "../components/customers/CustomerHeader.jsx";
import Tabs from "../components/ui/Tabs.jsx";
import Pill from "../components/ui/Pill.jsx";
import Icon from "../components/ui/Icon.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import LedgerBar from "../components/diagrams/LedgerBar.jsx";
import LifecycleDiagram from "../components/diagrams/LifecycleDiagram.jsx";
import { PaymentModal, CorrectionModal } from "../components/customers/PaymentForm.jsx";
import {
  ArchiveModal,
  DeleteCustomerModal,
  EditCustomerModal,
  MembershipModal,
} from "../components/customers/CustomerModals.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { money } from "../lib/money.js";
import { fmtDate, shiftISO, daysFromToday, plural } from "../lib/dates.js";
import {
  planOf,
  memType,
  memStatus,
  memPaid,
  memBalance,
  paymentLabels,
  sortedMemberships,
  currentMembership,
  customerBalance,
  lastVisit,
  visitsIn30,
} from "../lib/status.js";
import { sessionNameFor } from "../data/sessions.js";

function PaymentPills({ membership, payments }) {
  return (
    <>
      {paymentLabels(membership, payments).map((l) => (
        <Pill label={l} key={l} />
      ))}
    </>
  );
}

/** One membership row: plan, dates, status pills and its ledger bar. */
function MembershipCard({ m, isCurrent, payments }) {
  const plan = planOf(m.plan);
  const paid = memPaid(m, payments);
  const bal = memBalance(m, payments);
  const showPills = isCurrent || paymentLabels(m, payments)[0] !== "Paid";
  return (
    <div className="member-item">
      <div className="member-top">
        <div>
          <p className="member-name">
            {plan.name} {isCurrent && <span className="tag" style={{ marginLeft: 6 }}>Current</span>}
          </p>
          <p className="member-dates">{fmtDate(m.start)} – {fmtDate(m.end)}</p>
        </div>
        <div className="hstack">
          <Pill label={memStatus(m)} />
          {showPills && <PaymentPills membership={m} payments={payments} />}
        </div>
      </div>
      <div className="ledger" style={{ marginTop: 10 }}>
        <div className="ledger-row">
          <LedgerBar price={m.price} paid={paid} />
          <div className="ledger-nums">
            <span>Price {money(m.price)}</span>
            <span>Paid {money(paid)}</span>
            {bal > 0 ? <span className="dead">Owed {money(bal)}</span> : <span>Settled</span>}
            {memType(m) === "session" && (
              <span>{m.sessionsLeft || 0} of {m.sessionsTotal} sessions left</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniHeat({ log, visits }) {
  const set = {};
  (log || []).forEach((d) => {
    set[d] = true;
  });
  const cells = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = shiftISO(-i);
    const on = !!set[d];
    cells.push(
      <span
        key={d}
        className={"mini-cell " + (on ? "on" : "off")}
        title={fmtDate(d) + (on ? " · visited" : " · no visit")}
      />,
    );
  }
  return (
    <div
      className="mini-heat"
      style={{ gridTemplateColumns: "repeat(10,1fr)", maxWidth: 280 }}
      role="img"
      aria-label={"Attendance for the last 30 days: " + visits + " visits."}
    >
      {cells}
    </div>
  );
}

function VisitList({ log }) {
  const list = (log || []).slice().sort().reverse().slice(0, 6);
  if (!list.length) return null;
  return (
    <ul className="visit-list">
      {list.map((d) => (
        <li key={d}>
          <span>
            <span className="mono" style={{ fontSize: "11.5px" }}>{fmtDate(d)}</span>
            <span className="muted"> · {sessionNameFor(d)}</span>
          </span>
          <span className="pill pill--active" style={{ height: 20 }}>Checked in</span>
        </li>
      ))}
    </ul>
  );
}

/** Customer detail: identity header, four tabs, owner-only notes, money actions. */
export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || !user?.role;
  const { customerById, fetchCustomerDetail, payments, saveNotes, setArchived, sel, attendanceLog, loading, error, refreshData } = useData();
  const { push } = useToast();
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState("");

  const customer = customerById(id);

  useEffect(() => {
    setTab("overview");
    if (id && fetchCustomerDetail) {
      fetchCustomerDetail(id);
    }
  }, [id, fetchCustomerDetail]);

  useEffect(() => {
    setDraft(customer ? customer.notes || "" : "");
  }, [customer]);

  if (loading && !customer) {
    return (
      <div className="empty-state" style={{ padding: "80px 0" }}>
        <p>Loading customer profile…</p>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="empty-state" style={{ padding: "80px 0" }}>
        <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>
        <button className="btn btn-primary btn-sm" type="button" onClick={refreshData}>
          Retry
        </button>
      </div>
    );
  }

  if (!customer) {
    return (
      <>
        <div className="page-head">
          <div className="page-head-main">
            <h1 className="page-title">Customer not found</h1>
            <p className="page-meta">That customer ID is not in this register.</p>
          </div>
        </div>
        <div className="empty-state">
          <p>Nothing to show for “{id || ""}”.</p>
          <div className="hstack">
            <Link className="btn btn-sm" to="/customers">Back to customers</Link>
          </div>
        </div>
      </>
    );
  }

  const membership = currentMembership(customer);
  const balance = customerBalance(customer, payments);
  const paidCount = payments.filter((p) => p.customerId === customer.id).length;
  const visits = visitsIn30(attendanceLog, customer.id);
  const last = lastVisit(attendanceLog, customer.id);

  const actions = customer.archived ? (
    <>
      <button
        className="btn"
        type="button"
        onClick={async () => {
          await setArchived(customer.id, false);
          push(customer.name + " restored to the register.");
        }}
      >
        Restore customer
      </button>
      <button className="btn" type="button" onClick={() => setModal("edit")}>Edit details</button>
      {isOwner && (
        <button className="btn btn-danger" type="button" onClick={() => setModal("delete")}>
          Delete
        </button>
      )}
    </>
  ) : (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setModal("payment")}>
        Record payment
      </button>
      <button className="btn" type="button" onClick={() => setModal("renew")}>Renew</button>
      <button className="btn" type="button" onClick={() => setModal("edit")}>Edit</button>
      <button className="btn" type="button" onClick={() => setModal("archive")}>Archive</button>
      {isOwner && (
        <button className="btn btn-danger" type="button" onClick={() => setModal("delete")}>
          Delete
        </button>
      )}
    </>
  );

  const tabItems = [
    { key: "overview", label: "Overview" },
    { key: "memberships", label: "Memberships", count: customer.memberships.length },
    { key: "payments", label: "Payments", count: paidCount },
    { key: "attendance", label: "Attendance", count: visits },
  ];

  let panel = null;

  if (tab === "overview") {
    const plan = membership ? planOf(membership.plan) : null;
    const paidAll = payments
      .filter((p) => p.customerId === customer.id && p.kind !== "correction")
      .reduce((s, p) => s + p.amount, 0);
    const recent = payments
      .filter((p) => p.customerId === customer.id)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3);

    panel = (
      <div className="detail-grid">
        <div className="stack">
          <section className="card" aria-labelledby="cm-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="cm-title">Current membership</h2>
                <p className="card-sub">Started on a package, expires by date or sessions.</p>
              </div>
              {membership && <Pill label={memStatus(membership)} />}
            </div>
            <div className="card-body">
              {membership ? (
                <>
                  <div className="hstack" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-.025em" }}>
                        {plan.name}
                      </p>
                      <p className="member-dates">
                        {fmtDate(membership.start)} – {fmtDate(membership.end)} · {membership.id}
                      </p>
                    </div>
                    <div className="hstack" style={{ justifyContent: "flex-end" }}>
                      <PaymentPills membership={membership} payments={payments} />
                    </div>
                  </div>
                  <dl className="fact-list" style={{ marginTop: 14 }}>
                    <div className="fact"><dt>Price</dt><dd>{money(membership.price)}</dd></div>
                    <div className="fact"><dt>Recorded payments</dt><dd>{money(memPaid(membership, payments))}</dd></div>
                    <div className="fact">
                      <dt>Balance on this membership</dt>
                      <dd style={memBalance(membership, payments) > 0 ? { color: "var(--danger)" } : undefined}>
                        {money(memBalance(membership, payments))}
                      </dd>
                    </div>
                    {memType(membership) === "session" ? (
                      <div className="fact"><dt>Sessions left</dt><dd>{membership.sessionsLeft} of {membership.sessionsTotal}</dd></div>
                    ) : (
                      <div className="fact"><dt>Days left</dt><dd>{Math.max(0, daysFromToday(membership.end))}</dd></div>
                    )}
                    <div className="fact">
                      <dt>Payment status</dt>
                      <dd className="plain" style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <PaymentPills membership={membership} payments={payments} />
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="muted">No membership on file. Add one to start tracking attendance and payments.</p>
              )}
            </div>
            <div className="card-foot">
              <button className="btn btn-sm" type="button" onClick={() => setTab("memberships")}>Membership history</button>
              <button className="btn btn-sm btn-primary" type="button" onClick={() => setModal("payment")}>
                Record payment
              </button>
            </div>
          </section>

          <section className="card" aria-labelledby="recent-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="recent-title">Recent payments</h2>
                <p className="card-sub">Cash recorded by hand. Amounts are not verified automatically.</p>
              </div>
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => setTab("payments")}>All payments</button>
            </div>
            {recent.length ? (
              <div className="table-wrap">
                <table className="table" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Method</th>
                      <th scope="col" className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((p) => (
                      <tr key={p.id} style={{ cursor: "default" }}>
                        <td className="td-id">{fmtDate(p.date)}</td>
                        <td>
                          {p.method}
                          {p.kind === "correction" && (
                            <> · <span className="pill pill--neutral" style={{ height: 18 }}>Correction</span></>
                          )}
                        </td>
                        <td className="right td-money">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-body">
                <p className="muted" style={{ fontSize: "12.5px" }}>
                  No payments recorded for {customer.name} yet. The full balance is still open.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card locked" aria-labelledby="notes-title">
            <div className="card-head">
              <div>
                <span className="lock-label"><Icon name="lock" /> Private · owner only</span>
                <h2 className="card-title" id="notes-title" style={{ marginTop: 5 }}>Notes</h2>
              </div>
              <span className="tag">Owner</span>
            </div>
            <div className="card-body">
              <label className="sr-only" htmlFor="private-notes">Private notes for {customer.name}</label>
              <textarea
                className="textarea notes-area"
                id="private-notes"
                maxLength={800}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="hstack" style={{ justifyContent: "space-between", marginTop: 8 }}>
                <span className="field-hint">Only the owner account can read this.</span>
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={async () => {
                    await saveNotes(customer.id, draft);
                    push("Private notes saved for " + customer.name + ".");
                  }}
                >
                  Save note
                </button>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="snap-title">
            <div className="card-head">
              <h2 className="card-title" id="snap-title">At a glance</h2>
            </div>
            <div className="card-body">
              <dl className="fact-list">
                <div className="fact"><dt>Customer ID</dt><dd>{customer.id}</dd></div>
                <div className="fact"><dt>Phone</dt><dd>{customer.phone}</dd></div>
                <div className="fact"><dt>Joined</dt><dd>{fmtDate(customer.joined)}</dd></div>
                <div className="fact"><dt>Total cash received</dt><dd>{money(paidAll)}</dd></div>
                <div className="fact">
                  <dt>Open balance</dt>
                  <dd style={balance > 0 ? { color: "var(--danger)" } : undefined}>{money(balance)}</dd>
                </div>
                <div className="fact"><dt>Last visit</dt><dd>{last ? fmtDate(last) : "None"}</dd></div>
                <div className="fact"><dt>Visits, last 30 days</dt><dd>{visits}</dd></div>
              </dl>
            </div>
          </section>
        </div>
      </div>
    );
  } else if (tab === "memberships") {
    const list = sortedMemberships(customer).slice().reverse();
    panel = (
      <div className="stack">
        <section className="card" aria-labelledby="hist-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="hist-title">Membership history</h2>
              <p className="card-sub">
                Every package this customer has held, newest first. Renewals add a new entry — old ones stay.
              </p>
            </div>
            <button className="btn btn-sm" type="button" onClick={() => setModal("renew")}>Add membership</button>
          </div>
          <div>
            {list.length ? (
              list.map((m) => (
                <MembershipCard
                  key={m.id}
                  m={m}
                  isCurrent={membership && membership.id === m.id}
                  payments={payments}
                />
              ))
            ) : (
              <div className="card-body">
                <p className="muted">No memberships yet.</p>
              </div>
            )}
          </div>
        </section>
        <section className="card" aria-labelledby="life2-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="life2-title">Lifecycle reference</h2>
              <p className="card-sub">Where all current customers sit today. One customer, one current state.</p>
            </div>
          </div>
          <div className="card-body">
            <LifecycleDiagram counts={sel.counts} />
          </div>
        </section>
      </div>
    );
  } else if (tab === "payments") {
    const rows = payments
      .filter((p) => p.customerId === customer.id)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const cash = rows
      .filter((p) => p.kind !== "correction")
      .reduce((s, p) => s + p.amount, 0);
    const value = customer.memberships.reduce((s, m) => s + m.price, 0);
    const corrections = rows.filter((p) => p.kind === "correction").length;
    const memberships = sortedMemberships(customer).slice().reverse();

    panel = (
      <div className="stack">
        <section className="card" aria-labelledby="ledger-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="ledger-title">Payment ledger</h2>
              <p className="card-sub">Each membership is a bar: paid, part-paid, or still owed.</p>
            </div>
            <div className="hstack">
              <button className="btn btn-sm" type="button" onClick={() => setModal("correction")}>Log correction</button>
              <button className="btn btn-sm btn-primary" type="button" onClick={() => setModal("payment")}>
                Record payment
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="ledger">
              {memberships.length ? (
                memberships.map((m) => (
                  <div className="ledger-row" key={m.id}>
                    <div className="ledger-top">
                      <span className="ledger-name">{planOf(m.plan).name}</span>
                      <span className="ledger-dates">{fmtDate(m.start)} – {fmtDate(m.end)}</span>
                    </div>
                    <LedgerBar price={m.price} paid={memPaid(m, payments)} />
                    <div className="ledger-nums">
                      <span>Price {money(m.price)}</span>
                      <span>Paid {money(memPaid(m, payments))}</span>
                      {memBalance(m, payments) > 0 ? (
                        <span className="dead">Owed {money(memBalance(m, payments))}</span>
                      ) : (
                        <span>Settled</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No memberships to show.</p>
              )}
            </div>
            <div className="diagram-legend" aria-hidden="true">
              <span><i style={{ background: "var(--accent)", borderColor: "var(--accent)" }} />Paid in full</span>
              <span><i style={{ background: "var(--info)", borderColor: "var(--info)" }} />Part-payment received</span>
              <span>
                <i style={{ background: "repeating-linear-gradient(135deg,transparent 0 3px,var(--tint-danger) 3px 5px)", borderColor: "var(--danger)" }} />
                Still owed
              </span>
            </div>
            <dl className="fact-list" style={{ marginTop: 14 }}>
              <div className="fact"><dt>Cash received on this account</dt><dd>{money(cash)}</dd></div>
              <div className="fact"><dt>Membership value sold</dt><dd>{money(value)}</dd></div>
              <div className="fact">
                <dt>Outstanding balance</dt>
                <dd style={balance > 0 ? { color: "var(--danger)" } : undefined}>{money(balance)}</dd>
              </div>
            </dl>
            <p className="note-line" style={{ marginTop: 12 }}>
              Cash received and membership value are different figures. Neither one is a balance until it is unpaid.
            </p>
          </div>
        </section>

        <section className="card" aria-labelledby="pay-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="pay-title">Recorded payments</h2>
              <p className="card-sub">Hand-recorded entries. Nothing here is processed or verified automatically.</p>
            </div>
            <span className="tag">
              {rows.length} {plural(rows.length, "entry", "entries")}
              {corrections ? " · " + corrections + " corrections" : ""}
            </span>
          </div>
          {rows.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Method</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Membership</th>
                    <th scope="col" className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const m = customer.memberships.find((x) => x.id === p.membershipId);
                    return (
                      <tr key={p.id} style={{ cursor: "default" }}>
                        <td className="td-id">{fmtDate(p.date)}</td>
                        <td>
                          {p.method}
                          {p.kind === "correction" && (
                            <> <span className="pill pill--neutral" style={{ height: 18 }}>Correction</span></>
                          )}
                          {p.reason && <div className="td-sub">{p.reason}</div>}
                        </td>
                        <td className="td-id">{p.ref || "—"}</td>
                        <td style={{ fontSize: 12 }}>{m ? planOf(m.plan).name : "—"}</td>
                        <td className="right td-money" style={p.amount < 0 ? { color: "var(--danger)" } : undefined}>
                          {money(p.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-body">
              <EmptyState
                actions={
                  <button className="btn btn-sm btn-primary" type="button" onClick={() => setModal("payment")}>
                    Record first payment
                  </button>
                }
              >
                No payments recorded for {customer.name}. The balance is still open.
              </EmptyState>
            </div>
          )}
          <div className="card-foot">
            <span className="fine-print">
              Payments cannot be edited or deleted. A mistake is fixed with a logged correction, which keeps the
              original entry visible.
            </span>
          </div>
        </section>
      </div>
    );
  } else {
    panel = (
      <div className="detail-grid">
        <section className="card" aria-labelledby="att-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="att-title">Last 30 days</h2>
              <p className="card-sub">Each square is a day. Filled means the customer was marked present or late.</p>
            </div>
            <span className="tag">{visits} visits</span>
          </div>
          <div className="card-body">
            <div className="chart-frame">
              <MiniHeat log={attendanceLog[customer.id]} visits={visits} />
              <div className="chart-caption">
                Oldest day on the left, today on the right.{" "}
                {last ? "Last visit " + fmtDate(last) + "." : "No visit recorded yet."}
              </div>
            </div>
            <dl className="fact-list" style={{ marginTop: 14 }}>
              <div className="fact"><dt>Visits in 30 days</dt><dd>{visits}</dd></div>
              <div className="fact"><dt>Last visit</dt><dd>{last ? fmtDate(last) : "None"}</dd></div>
              <div className="fact">
                <dt>Current membership</dt>
                <dd className="plain">{membership ? memStatus(membership) : "None"}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section className="card" aria-labelledby="visit-title">
          <div className="card-head">
            <h2 className="card-title" id="visit-title">Recent visits</h2>
            <Link className="btn btn-sm" to="/attendance">Open attendance</Link>
          </div>
          <div className="card-body">
            {last || (attendanceLog[customer.id] || []).length ? (
              <VisitList log={attendanceLog[customer.id]} />
            ) : (
              <EmptyState
                actions={
                  <Link className="btn btn-sm" to="/attendance">Mark attendance</Link>
                }
              >
                No visits recorded for this customer yet.
              </EmptyState>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <CustomerHeader customer={customer} membership={membership} payments={payments} actions={actions} />
      <Tabs items={tabItems} value={tab} onChange={setTab} ariaLabel="Customer sections" />
      <div role="tabpanel" aria-label={tab}>{panel}</div>
      {balance > 0 && !customer.archived && (
        <p className="fine-print" style={{ marginTop: 18 }}>
          Open balance across all memberships:{" "}
          <strong className="mono" style={{ color: "var(--danger)" }}>{money(balance)}</strong>. Cash received is not
          shown as a balance.
        </p>
      )}

      {modal === "payment" && <PaymentModal customerId={customer.id} onClose={() => setModal(null)} />}
      {modal === "correction" && <CorrectionModal customerId={customer.id} onClose={() => setModal(null)} />}
      {modal === "renew" && <MembershipModal customerId={customer.id} mode="renew" onClose={() => setModal(null)} />}
      {modal === "edit" && <EditCustomerModal customerId={customer.id} onClose={() => setModal(null)} />}
      {modal === "archive" && <ArchiveModal customerId={customer.id} onClose={() => setModal(null)} />}
      {modal === "delete" && (
        <DeleteCustomerModal
          customerId={customer}
          onClose={() => setModal(null)}
          onDeleted={() => navigate("/customers", { replace: true })}
          onArchiveInstead={() => setModal("archive")}
        />
      )}
    </>
  );
}