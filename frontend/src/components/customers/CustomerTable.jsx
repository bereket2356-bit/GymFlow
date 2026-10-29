import { Link } from "react-router-dom";
import Pill from "../ui/Pill.jsx";
import { money } from "../../lib/money.js";
import { fmtDate, fmtShort, daysLabel, daysFromToday, daysBetween } from "../../lib/dates.js";
import { planOf, memType, currentMembership, customerBalance, memStatus, paymentLabels } from "../../lib/status.js";

/** Progress bar: sessions left for packs, days left for time-based memberships. */
function Progress({ membership }) {
  if (!membership) return null;
  if (memType(membership) === "session") {
    const total = membership.sessionsTotal || 1;
    const left = membership.sessionsLeft == null ? total : membership.sessionsLeft;
    const pct = Math.round((left / total) * 100);
    const cls = left === 0 ? "is-low" : left <= 2 ? "is-soon" : "is-ok";
    return (
      <div className={"progress " + cls} aria-hidden="true">
        <i style={{ width: pct + "%" }} />
      </div>
    );
  }
  const span = Math.max(1, daysBetween(membership.start, membership.end));
  const left = Math.max(0, daysFromToday(membership.end));
  const pct = Math.max(0, Math.min(100, Math.round((left / span) * 100)));
  const cls = left <= 7 ? "is-soon" : "is-ok";
  return (
    <div className={"progress " + cls} aria-hidden="true">
      <i style={{ width: pct + "%" }} />
    </div>
  );
}

function ExpiryCell({ membership }) {
  if (!membership) return <span className="muted">No membership</span>;
  if (memType(membership) === "session") {
    const left = membership.sessionsLeft == null ? 0 : membership.sessionsLeft;
    return (
      <>
        <div className="td-money">
          {left} of {membership.sessionsTotal} left
        </div>
        <div className="td-sub">
          Valid to {fmtShort(membership.end)} · {daysLabel(daysFromToday(membership.end))}
        </div>
        <Progress membership={membership} />
      </>
    );
  }
  const d = daysFromToday(membership.end);
  return (
    <>
      <div className="td-money">{fmtDate(membership.end)}</div>
      <div className="td-sub">{d < 0 ? Math.abs(d) + " days ago" : daysLabel(d)}</div>
      <Progress membership={membership} />
    </>
  );
}

function SortHeader({ label, column, sortKey, dir, onSort }) {
  const on = sortKey === column;
  return (
    <button
      className="sort-btn"
      type="button"
      onClick={() => onSort(column)}
      aria-label={"Sort by " + label + (on ? ", " + dir + "ending" : "")}
    >
      {label}
      {on && <span className="arrow" aria-hidden="true">{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

/** The customer register table. Rows link to `/customers/:id`. */
export default function CustomerTable({ customers, payments, sortKey, dir, onSort }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Customer register with package, expiry, membership status, payment status and balance.</caption>
        <thead>
          <tr>
            <th scope="col"><SortHeader label="Customer" column="name" sortKey={sortKey} dir={dir} onSort={onSort} /></th>
            <th scope="col"><SortHeader label="Package" column="plan" sortKey={sortKey} dir={dir} onSort={onSort} /></th>
            <th scope="col"><SortHeader label="Expiry / sessions" column="expiry" sortKey={sortKey} dir={dir} onSort={onSort} /></th>
            <th scope="col"><SortHeader label="Membership" column="status" sortKey={sortKey} dir={dir} onSort={onSort} /></th>
            <th scope="col">Payment</th>
            <th scope="col" className="right"><SortHeader label="Balance" column="balance" sortKey={sortKey} dir={dir} onSort={onSort} /></th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const m = currentMembership(c);
            const plan = m ? planOf(m.plan).name : "No package";
            const bal = customerBalance(c, payments);
            return (
              <tr key={c.id}>
                <td>
                  <Link className="td-name" to={"/customers/" + c.id} aria-label={"Open " + c.name + ", " + c.id}>
                    {c.name}
                  </Link>
                  <div className="td-id">{c.id}{c.archived ? " · archived" : ""}</div>
                </td>
                <td>
                  <div>{plan}</div>
                  <div className="td-sub">{m && memType(m) === "session" ? "Session-based" : "Time-based"}</div>
                </td>
                <td><ExpiryCell membership={m} /></td>
                <td><Pill label={memStatus(m)} /></td>
                <td>
                  {paymentLabels(m, payments).map((l) => (
                    <Pill label={l} key={l} className="mr-1" />
                  ))}
                </td>
                <td className={"right td-money " + (bal > 0 ? "danger" : "muted")}>{money(bal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function sortValue(c, key, payments) {
  const m = currentMembership(c);
  if (key === "name") return c.name.toLowerCase();
  if (key === "id") return c.id;
  if (key === "plan") return m ? planOf(m.plan).name.toLowerCase() : "";
  if (key === "status") return memStatus(m);
  if (key === "balance") return customerBalance(c, payments);
  return m ? m.end || m.start : "";
}
