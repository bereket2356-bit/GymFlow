import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import KpiCard from "../components/ui/KpiCard.jsx";
import Icon from "../components/ui/Icon.jsx";
import Sparkline from "../components/diagrams/Sparkline.jsx";
import RevenueDonut from "../components/diagrams/RevenueDonut.jsx";
import SessionTimeline from "../components/diagrams/SessionTimeline.jsx";
import LifecycleDiagram from "../components/diagrams/LifecycleDiagram.jsx";
import { NewCustomerModal, MembershipModal } from "../components/customers/CustomerModals.jsx";
import { PaymentModal } from "../components/customers/PaymentForm.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { money, num } from "../lib/money.js";
import { TODAY, fmtLong, fmtShort, clockLabel, daysFromToday, daysLabel, plural } from "../lib/dates.js";
import { currentMembership, memStatus } from "../lib/status.js";
import { TZ_LABEL } from "../data/config.js";

const PERIODS = [
  ["month", "This month"],
  ["30d", "Last 30 days"],
  ["7d", "Last 7 days"],
  ["quarter", "Last 90 days"],
];

const TONES = {
  danger: { color: "var(--danger)", background: "var(--tint-danger)" },
  warning: { color: "var(--warning)", background: "var(--tint-warning)" },
  info: { color: "var(--info)", background: "var(--tint-info)" },
  neutral: { color: "var(--text-muted)", background: "var(--tint-neutral)" },
};

function ReminderItem({ reminder, reviewed, onReview, onOpen }) {
  const style = TONES[reminder.tone] || TONES.neutral;
  return (
    <li className={"reminder" + (reviewed ? " is-reviewed" : "")}>
      <div className="reminder-main">
        <div className="reminder-rule">
          <span className="tag" style={style}>{reminder.rule}</span>
          <span className="td-id">{reminder.customer.id}</span>
        </div>
        <p className="reminder-text">
          <button type="button" onClick={() => onOpen(reminder.customer.id)}>{reminder.customer.name}</button> —{" "}
          {reminder.text}
        </p>
      </div>
      <div className="reminder-actions">
        {reviewed ? (
          <span className="pill pill--reviewed">Reviewed</span>
        ) : (
          <button className="link-quiet" type="button" onClick={() => onReview(reminder)}>
            Mark reviewed
          </button>
        )}
      </div>
    </li>
  );
}

/** Dashboard: instrument strip, revenue, reminders, today's sessions, quick actions. */
export default function Dashboard() {
  const { sel, period, setPeriod, isReviewed, markReviewed, sessions, loading, error, refreshData } = useData();
  const { push } = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);

  if (loading) {
    return (
      <div className="empty-state" style={{ padding: "80px 0" }}>
        <p>Loading dashboard instruments…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state" style={{ padding: "80px 0" }}>
        <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>
        <button className="btn btn-primary btn-sm" type="button" onClick={refreshData}>
          Retry connection
        </button>
      </div>
    );
  }

  const k = sel.kpi;
  const counts = k.counts;
  const range = k.range;
  const reminders = sel.reminders;
  const open = reminders.filter((r) => !isReviewed(r.key));
  const reviewedCount = reminders.length - open.length;
  const openBalances = sel.nonArchived().filter((c) => sel.balanceOfCustomer(c) > 0).length;
  const totalMoney = k.collected + k.outstanding;
  const pct = totalMoney > 0 ? Math.round((k.collected / totalMoney) * 100) : 0;

  const expiringNow = sel
    .nonArchived()
    .filter((c) => memStatus(currentMembership(c)) === "Expiring soon")
    .map((c) => c.name.split(" ")[0] + " " + daysLabel(daysFromToday(currentMembership(c).end)));
  const expiredNow = sel
    .nonArchived()
    .filter((c) => memStatus(currentMembership(c)) === "Expired")
    .map((c) => c.name.split(" ")[0] + ", " + Math.abs(daysFromToday(currentMembership(c).end)) + " days ago");

  const review = async (r) => {
    await markReviewed(r.key);
    push("Reminder marked reviewed for " + r.customer.name + ". The record is unchanged.");
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-meta">
            <span>{fmtLong(TODAY)}</span>
            <span className="dot-sep" />
            <span className="mono">{clockLabel()}</span>
            <span className="dot-sep" />
            <span>{TZ_LABEL}</span>
          </p>
          <p className="hero-sentence">
            {k.active} memberships live, {k.expiring} lapsing inside the week,{" "}
            <span className="num danger">{money(k.outstanding)}</span> uncollected.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" type="button" onClick={() => setModal("customer")}>
            <Icon name="plus" />
            New customer
          </button>
          <button className="btn" type="button" onClick={() => setModal("membership")}>
            <Icon name="calendar" />
            New membership
          </button>
        </div>
      </div>

      <section className="kpi-strip" aria-label="Key figures">
        <KpiCard
          label="Customers"
          value={num(k.total)}
          meta={k.live + " live · " + k.archived + " archived"}
          spark={<Sparkline values={[6, 7, 8, k.total]} />}
        />
        <KpiCard
          label="Active memberships"
          value={num(k.active)}
          meta={k.exhausted + " exhausted · " + k.scheduled + " scheduled"}
          spark={<Sparkline values={[4, 5, 5, k.active]} />}
        />
        <KpiCard
          label="Expiring · 7 days"
          value={num(k.expiring)}
          meta={expiringNow.length ? expiringNow.join(" · ") : "None this week"}
          spark={<Sparkline values={[1, 2, 2, k.expiring]} />}
        />
        <KpiCard
          label="Expired"
          value={num(k.expired)}
          meta={expiredNow.length ? expiredNow[0] : "None"}
          spark={<Sparkline values={[2, 1, 1, k.expired]} />}
        />
        <KpiCard
          label="Cash received"
          value={money(k.collected)}
          meta={range.label}
          spark={<Sparkline values={sel.weeklyCollected(4)} tone="accent" />}
          tone="accent"
        />
        <KpiCard
          label="Outstanding"
          value={money(k.outstanding)}
          meta={"Across " + openBalances + " " + plural(openBalances, "balance")}
          spark={<Sparkline values={[520, 560, 575, k.outstanding]} tone="danger" />}
          tone="danger"
        />
      </section>

      <div className="dash-grid">
        <section className="card col-4" aria-labelledby="rev-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="rev-title">Cash collected</h2>
              <p className="card-sub">
                {range.label} · {fmtShort(range.from)} – {fmtShort(range.to)}
              </p>
            </div>
            <select
              className="select period-select"
              aria-label="Revenue period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIODS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="card-body">
            <div className="donut-wrap">
              <RevenueDonut collected={k.collected} outstanding={k.outstanding} />
              <div className="donut-legend">
                <div className="legend-row">
                  <span className="swatch" style={{ background: "var(--accent)" }} />
                  <span className="legend-label">Cash received</span>
                  <span className="legend-val">{money(k.collected)}</span>
                </div>
                <div className="legend-row">
                  <span className="swatch swatch--outline" />
                  <span className="legend-label">Still outstanding</span>
                  <span className="legend-val">{money(k.outstanding)}</span>
                </div>
                <div className="legend-row">
                  <span className="swatch" style={{ background: "var(--border)" }} />
                  <span className="legend-label">Share collected</span>
                  <span className="legend-val">{pct}%</span>
                </div>
              </div>
            </div>
            <p className="note-line" style={{ marginTop: 14 }}>
              Cash received is money collected in this period. It is neither membership value nor the outstanding
              balance.
            </p>
          </div>
        </section>

        <section className="card col-8" aria-labelledby="rem-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="rem-title">Dashboard reminders</h2>
              <p className="card-sub">
                {open.length} open · {reviewedCount} reviewed. Each one links to the customer record.
              </p>
            </div>
            <span className="tag">Internal</span>
          </div>
          <div className="reminder-note" role="note">
            <span className="dot" aria-hidden="true" />
            <span>
              <strong>Not customer messages.</strong> Reminders are notes for the owner. The system sends nothing — no
              email, SMS or app notification. <strong>No message is sent to the customer.</strong>
            </span>
          </div>
          {reminders.length ? (
            <ul className="reminder-list">
              {reminders.map((r) => (
                <ReminderItem
                  key={r.key}
                  reminder={r}
                  reviewed={isReviewed(r.key)}
                  onReview={review}
                  onOpen={(id) => navigate("/customers/" + id)}
                />
              ))}
            </ul>
          ) : (
            <div className="card-body">
              <div className="empty-state">
                <p>No reminders today. Every membership, balance and visit window is clear.</p>
              </div>
            </div>
          )}
          <div className="card-foot">
            <span className="fine-print">
              Reviewing a reminder only hides it from this list. It does not edit the customer, payment or membership.
            </span>
            <Link className="card-link" to="/customers">Open customers</Link>
          </div>
        </section>

        <section className="card col-7" aria-labelledby="today-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="today-title">Today’s sessions</h2>
              <p className="card-sub">05:00 – 21:00 · {TZ_LABEL} · block length is session duration</p>
            </div>
            <button className="btn btn-sm" type="button" onClick={() => navigate("/attendance")}>
              Mark attendance
            </button>
          </div>
          <div className="card-body">
            <SessionTimeline sessions={sessions} />
          </div>
        </section>

        <section className="card col-5" aria-labelledby="qa-title">
          <div className="card-head">
            <h2 className="card-title" id="qa-title">Quick actions</h2>
          </div>
          <div className="actions-grid">
            <button className="action-tile" type="button" onClick={() => setModal("customer")}>
              <span className="tile-k"><Icon name="plus" /></span>
              <span>
                <span className="tile-t">New customer</span>
                <span className="tile-s">Name, phone and starting package</span>
              </span>
            </button>
            <button className="action-tile" type="button" onClick={() => setModal("membership")}>
              <span className="tile-k"><Icon name="calendar" /></span>
              <span>
                <span className="tile-t">New membership</span>
                <span className="tile-s">Add or renew a package</span>
              </span>
            </button>
            <button className="action-tile" type="button" onClick={() => setModal("payment")}>
              <span className="tile-k"><Icon name="card" /></span>
              <span>
                <span className="tile-t">Record payment</span>
                <span className="tile-s">Cash, transfer, card or mobile money</span>
              </span>
            </button>
            <button className="action-tile" type="button" onClick={() => navigate("/attendance")}>
              <span className="tile-k"><Icon name="attendance" /></span>
              <span>
                <span className="tile-t">Mark attendance</span>
                <span className="tile-s">Roster and session deduction</span>
              </span>
            </button>
          </div>
        </section>

        <section className="card col-12" aria-labelledby="life-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="life-title">Membership lifecycle</h2>
              <p className="card-sub">
                One customer, one current state. Counts update as memberships are added, renewed or run out.
              </p>
            </div>
            <span className="pill pill--accent pill--plain">
              {counts.Scheduled + counts.Active + counts["Expiring soon"] + counts.Expired + counts.Exhausted} current
              memberships
            </span>
          </div>
          <div className="card-body">
            <LifecycleDiagram counts={counts} />
          </div>
        </section>
      </div>

      {modal === "customer" && <NewCustomerModal onClose={() => setModal(null)} />}
      {modal === "membership" && <MembershipModal onClose={() => setModal(null)} />}
      {modal === "payment" && <PaymentModal onClose={() => setModal(null)} />}
    </>
  );
}