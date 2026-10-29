import Pill from "../ui/Pill.jsx";
import { money } from "../../lib/money.js";
import { packageTypeLabel, packageValidityText, packageSessionsText } from "../../data/packages.js";

/** Package catalogue: terms, active members, recorded revenue and status. */
export default function PackageTable({ packages, stats, onEdit, onToggle }) {
  return (
    <div className="table-wrap">
      <table className="table pkg-table">
        <caption className="sr-only">Membership packages, their terms, active members, recorded revenue and status.</caption>
        <thead>
          <tr>
            <th scope="col">Package</th>
            <th scope="col">Type</th>
            <th scope="col" className="right">Price</th>
            <th scope="col">Validity</th>
            <th scope="col">Sessions</th>
            <th scope="col" className="right">Active members</th>
            <th scope="col" className="right">Revenue</th>
            <th scope="col">Status</th>
            <th scope="col" className="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((p) => {
            const s = stats(p.id);
            return (
              <tr key={p.id} className={p.active ? "" : "pkg-inactive-row"}>
                <td className="pkg-name-cell">
                  <div className="td-name">
                    {p.name} {!p.active && <Pill label="Inactive" />}
                  </div>
                  <div className="td-sub">{p.id}</div>
                  {p.description && (
                    <div className="pkg-desc" title={p.description}>{p.description}</div>
                  )}
                </td>
                <td><span className="tag-type">{packageTypeLabel(p.type)}</span></td>
                <td className="td-money">{money(p.price)}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{packageValidityText(p)}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{packageSessionsText(p)}</td>
                <td className="td-money">{s.active}</td>
                <td className="td-money">{money(s.revenue)}</td>
                <td>{p.active ? <Pill label="Active" /> : <Pill label="Inactive" />}</td>
                <td>
                  <div className="pkg-actions">
                    <button className="btn btn-sm pkg-edit-btn" type="button" onClick={() => onEdit(p.id)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm pkg-status-toggle"
                      type="button"
                      data-active={p.active ? "true" : "false"}
                      onClick={() => onToggle(p)}
                    >
                      {p.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}