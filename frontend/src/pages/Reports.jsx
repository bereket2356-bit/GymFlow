import { useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiCard from "../components/ui/KpiCard.jsx";
import Pill from "../components/ui/Pill.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Sparkline from "../components/diagrams/Sparkline.jsx";
import WeeklyBars from "../components/diagrams/WeeklyBars.jsx";
import AttendanceHeatmap from "../components/diagrams/AttendanceHeatmap.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { money, num } from "../lib/money.js";
import { TODAY, fmtDate, shiftISO, monthStartISO } from "../lib/dates.js";
import { currentMembership, memStatus, paymentLabels, payStatus } from "../lib/status.js";
import { planOf } from "../lib/status.js";
import { TZ_LABEL } from "../data/config.js";

const PRESETS = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
];

function csvEscape(cell) {
  return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"';
}

/** Reports: cash received, membership value, outstanding and new customers, kept apart. */
export default function Reports() {
  const { sel, reports, setReports, payments } = useData();
  const { push } = useToast();
  const navigate = useNavigate();
  const [from, setFrom] = useState(reports.from);
  const [to, setTo] = useState(reports.to);
  const [error, setError] = useState("");

  const apply = (e) => {
    e.preventDefault();
    if (!from || !to) {
      setError("Choose both a start and an end date.");
      return;
    }
    if (from > to) {
      setError("The start date must be on or before the end date.");
      return;
    }
    setError("");
    setReports({ from, to });
  };

  const preset = (key) => {
    setError("");
    if (key === "7d") {
      const next = { from: shiftISO(-6), to: TODAY };
      setFrom(next.from);
      setTo(next.to);
      setReports(next);
    } else if (key === "30d") {
      const next = { from: shiftISO(-29), to: TODAY };
      setFrom(next.from);
      setTo(next.to);
      setReports(next);
    } else {
      const next = { from: monthStartISO(), to: TODAY };
      setFrom(next.from);
      setTo(next.to);
      setReports(next);
    }
  };

  const cash = sel.collectedIn(reports.from, reports.to);
  const value = sel.membershipValueIn(reports.from, reports.to);
  const outstanding = sel.totalOutstanding();
  const newC = sel.newCustomersIn(reports.from, reports.to);
  const weekly = sel.weeklyCollected(4);
  const valueSpark = [0, 1, 2, 3].map((i) =>
    sel.membershipValueIn(shiftISO(-7 * (3 - i) - 6), shiftISO(-7 * (3 - i))),
  );
  const outstandingSpark = [28, 21, 14, 7].map((days) => outstanding + sel.collectedIn(shiftISO(-days), TODAY));
  const owing = sel
    .nonArchived()
    .filter((c) => sel.balanceOfCustomer(c) > 0)
    .sort((a, b) => sel.balanceOfCustomer(b) - sel.balanceOfCustomer(a));

  const exportCsv = () => {
    const rows = [];
    rows.push(["BGMS report", "Foundry Boxing Club", fmtDate(reports.from) + " to " + fmtDate(reports.to), "All figures are owner-recorded sample data"]);
    rows.push([]);
    rows.push(["Metric", "Value"]);
    rows.push(["Cash received (manual payments)", cash]);
    rows.push(["Membership value sold", value]);
    rows.push(["Outstanding balance (today)", outstanding]);
    rows.push(["New customers", newC]);
    rows.push([]);
    rows.push(["Week ending", "Cash received"]);
    sel.weeklySeries(8).forEach((s) => rows.push([fmtDate(s.to), s.value]));
    rows.push([]);
    rows.push(["Customer ID", "Name", "Package", "Membership status", "Payment status", "Balance"]);
    owing.forEach((c) => {
      const m = sel.openMembershipFor(c) || currentMembership(c);
      rows.push([c.id, c.name, m ? planOf(m.plan).name : "", memStatus(m), payStatus(m, payments), sel.balanceOfCustomer(c)]);
    });
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const name = "bgms-report-" + TODAY + ".csv";
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    push("Report exported as " + name + ".");
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Reports</h1>
          <p className="page-meta">
            <span>{fmtDate(reports.from)} – {fmtDate(reports.to)}</span>
            <span className="dot-sep" />
            <span>Money figures are manual records</span>
            <span className="dot-sep" />
            <span>{TZ_LABEL}</span>
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
          <button className="btn" type="button" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <form className="card-body" onSubmit={apply} noValidate>
          <div className="report-range">
            <div className="field">
              <label className="label" htmlFor="rep-from">From</label>
              <input className="input" id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="rep-to">To</label>
              <input className="input" id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">Apply range</button>
            <div className="hstack" style={{ marginLeft: "auto" }}>
              {PRESETS.map(([key, label]) => (
                <button className="btn btn-sm" key={key} type="button" onClick={() => preset(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="field-error" role="alert" style={{ marginTop: 8 }}>{error}</p>
          )}
          <p className="field-hint" style={{ marginTop: 8 }}>
            Cash received counts payments dated inside the range. Membership value counts packages that started inside
            it. Outstanding is today’s open balance, not a range total.
          </p>
        </form>
      </section>

      <section className="kpi-strip kpi-4" aria-label="Report key figures">
        <KpiCard
          label="Cash received"
          value={money(cash)}
          meta="Manual payments in range"
          spark={<Sparkline values={weekly} tone="accent" />}
          tone="accent"
        />
        <KpiCard
          label="Membership value"
          value={money(value)}
          meta="Packages starting in range"
          spark={<Sparkline values={valueSpark} />}
        />
        <KpiCard
          label="Outstanding"
          value={money(outstanding)}
          meta="Open balances today"
          spark={<Sparkline values={outstandingSpark} tone="danger" />}
          tone="danger"
        />
        <KpiCard
          label="New customers"
          value={num(newC)}
          meta="Joined in range"
          spark={<Sparkline values={[0, 1, 1, newC]} />}
        />
      </section>

      <div className="chart-grid" style={{ marginBottom: 16 }}>
        <section className="card" aria-labelledby="bar-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="bar-title">Cash received by week</h2>
              <p className="card-sub">Eight weeks to today. This is cash, not membership value.</p>
            </div>
            <span className="tag">Hover for details</span>
          </div>
          <div className="card-body">
            <WeeklyBars series={sel.weeklySeries(8)} />
          </div>
        </section>
        <section className="card" aria-labelledby="heat-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="heat-title">Attendance heat map</h2>
              <p className="card-sub">Four weeks, Monday to Sunday. Darker cells mean more visits.</p>
            </div>
          </div>
          <div className="card-body">
            <AttendanceHeatmap />
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="owing-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="owing-title">Outstanding balances</h2>
            <p className="card-sub">Unpaid amounts today. Membership status is separate from payment status.</p>
          </div>
          <span className="tag">{money(outstanding)} total</span>
        </div>
        {owing.length ? (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Package</th>
                  <th scope="col">Membership</th>
                  <th scope="col">Payment</th>
                  <th scope="col" className="right">Balance</th>
                  <th scope="col" className="right">Open</th>
                </tr>
              </thead>
              <tbody>
                {owing.map((c) => {
                  const m = sel.openMembershipFor(c) || currentMembership(c);
                  return (
                    <tr key={c.id} style={{ cursor: "default" }}>
                      <td>
                        <div className="td-name">{c.name}</div>
                        <div className="td-id">{c.id}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{m ? planOf(m.plan).name : "—"}</td>
                      <td><Pill label={memStatus(m)} /></td>
                      <td>
                        {m
                          ? paymentLabels(m, payments).map((l) => <Pill label={l} key={l} />)
                          : null}
                      </td>
                      <td className="right td-money danger">{money(sel.balanceOfCustomer(c))}</td>
                      <td className="right">
                        <button className="btn btn-sm" type="button" onClick={() => navigate("/customers/" + c.id)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-body">
            <EmptyState>Nothing is outstanding. Every recorded membership balance is settled.</EmptyState>
          </div>
        )}
        <div className="card-foot">
          <span className="fine-print">
            Cash received (${cash.toLocaleString("en-US")}) and membership value (${value.toLocaleString("en-US")})
            are deliberately shown apart. Neither is the outstanding balance.
          </span>
        </div>
      </section>
    </>
  );
}