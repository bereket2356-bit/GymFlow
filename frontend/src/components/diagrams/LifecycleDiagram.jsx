import { plural } from "../../lib/dates.js";

const NODES = [
  { x: 12, y: 24, key: "Scheduled", tone: "info" },
  { x: 198, y: 24, key: "Active", tone: "success" },
  { x: 384, y: 24, key: "Expiring soon", tone: "warning" },
  { x: 570, y: 24, key: "Expired", tone: "danger" },
  { x: 198, y: 158, key: "Exhausted", tone: "info" },
];
const W = 146;
const H = 58;

/** Membership lifecycle: Scheduled → Active → Expiring soon → Expired, with the
 * session-pack Exhausted branch and a “Renewed” loop back to Active. */
export default function LifecycleDiagram({ counts }) {
  const c = counts || {};
  const label =
    "Membership lifecycle: " +
    (c.Scheduled || 0) +
    " scheduled, " +
    (c.Active || 0) +
    " active, " +
    (c["Expiring soon"] || 0) +
    " expiring soon, " +
    (c.Expired || 0) +
    " expired, " +
    (c.Exhausted || 0) +
    " exhausted.";
  return (
    <div>
      <div className="diagram-legend">
        <span><i style={{ background: "var(--success)", borderColor: "var(--success)" }} />Active</span>
        <span><i style={{ background: "var(--warning)", borderColor: "var(--warning)" }} />Expiring soon</span>
        <span><i style={{ background: "var(--danger)", borderColor: "var(--danger)" }} />Expired</span>
        <span><i style={{ background: "var(--info)", borderColor: "var(--info)" }} />Scheduled / exhausted</span>
      </div>
      <p className="diagram-caption" style={{ marginTop: 9 }}>
        Counts are customers whose current membership sits in each state today. Archived customers are excluded.
        “Renewed” loops a lapsed membership back to Active.
      </p>
      <div className="diagram-scroll">
        <svg className="diagram" viewBox="0 0 730 232" role="img" aria-label={label}>
          <defs>
            <marker id="lcArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 8 4 0 8z" fill="var(--text-muted)" />
            </marker>
          </defs>
          <g stroke="var(--text-muted)" strokeWidth="1.2" fill="none" markerEnd="url(#lcArrow)">
            <line x1={12 + W + 4} y1="53" x2={198 - 8} y2="53" />
            <line x1={198 + W + 4} y1="53" x2={384 - 8} y2="53" />
            <line x1={384 + W + 4} y1="53" x2={570 - 8} y2="53" />
            <line x1="240" y1="82" x2="240" y2="150" />
            <path d="M643 82 V126 H300 V90" />
          </g>
          <g fontSize="10.5" fill="var(--text-muted)" fontFamily="var(--font-ui)">
            <text x={198 + W / 2} y="120" textAnchor="middle">
              session pack
            </text>
            <text x="472" y="119" textAnchor="middle" fill="var(--accent-text)" fontSize="10">
              Renewed
            </text>
          </g>
          {NODES.map((n) => {
            const count = c[n.key] || 0;
            return (
              <g key={n.key} role="listitem" aria-label={n.key + ": " + count + " " + plural(count, "customer")}>
                <rect
                  className="lc-node is-on"
                  x={n.x}
                  y={n.y}
                  width={W}
                  height={H}
                  rx="2"
                  fill={"var(--" + n.tone + ")"}
                  fillOpacity=".08"
                  stroke={"var(--" + n.tone + ")"}
                  strokeOpacity=".8"
                />
                <text x={n.x + 12} y={n.y + 20} fontSize="9.5" letterSpacing="1" fill="var(--text-muted)">
                  {n.key.toUpperCase()}
                </text>
                <text x={n.x + 12} y={n.y + 45} fontSize="20" fontFamily="var(--font-mono)" fill={"var(--" + n.tone + ")"}>
                  {count}
                </text>
                <text x={n.x + W - 12} y={n.y + 44} fontSize="9" textAnchor="end" fill="var(--text-muted)">
                  {plural(count, "customer")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}