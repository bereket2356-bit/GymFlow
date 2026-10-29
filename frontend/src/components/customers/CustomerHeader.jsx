import { Link } from "react-router-dom";
import Pill from "../ui/Pill.jsx";
import { fmtDate } from "../../lib/dates.js";
import { memStatus, paymentLabels } from "../../lib/status.js";

/** Customer detail header: identity, status pills and the action row. */
export default function CustomerHeader({ customer, membership, payments, actions }) {
  const archived = customer.archived;
  const initials = customer.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div className="detail-head" style={{ marginBottom: 0, width: "100%" }}>
          <div className="detail-id">
            <span className="avatar lg" aria-hidden="true">{initials}</span>
            <div style={{ minWidth: 0 }}>
              <Link className="link-quiet" to="/customers" style={{ padding: 0, minHeight: 24 }}>
                ‹ Customers
              </Link>
              <h1 className="detail-name">{customer.name}</h1>
              <div className="detail-meta">
                <span className="mono">{customer.id}</span>
                <span className="dot-sep" />
                <span>{customer.phone}</span>
                <span className="dot-sep" />
                <span>Joined {fmtDate(customer.joined)}</span>
              </div>
              <div className="detail-pills">
                {membership && <Pill label={memStatus(membership)} />}
                {membership && paymentLabels(membership, payments).map((l) => <Pill label={l} key={l} />)}
                {archived && <span className="tag">Archived</span>}
              </div>
            </div>
          </div>
          <div className="detail-actions">{actions}</div>
        </div>
      </div>
      {archived && (
        <div className="callout callout--muted" style={{ marginBottom: 16 }}>
          <span>
            <strong>Archived customer.</strong> Records stay readable but the customer is hidden from the register and
            reminders. Restore to manage payments or memberships again.
          </span>
        </div>
      )}
    </>
  );
}