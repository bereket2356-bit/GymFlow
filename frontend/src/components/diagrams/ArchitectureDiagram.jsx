const ARIA =
  "System architecture: owner browser sends HTTPS requests to the API, which calls the backend, which reads and " +
  "writes MongoDB. A separate backup node takes nightly copies.";

function Node({ x, y, w, h, title, sub, tone }) {
  const stroke = tone ? "var(--" + tone + ")" : "var(--border)";
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="2" fill="var(--surface-2)" stroke={stroke} />
      <text x={x + 12} y={y + 23} fontSize="11.5" fontWeight="600" fill="var(--text)">
        {title}
      </text>
      <text x={x + 12} y={y + 39} fontSize="8.5" fill="var(--text-muted)">
        {sub}
      </text>
    </>
  );
}

/** Browser → API → backend → MongoDB, with a nightly backup copy. */
export default function ArchitectureDiagram() {
  return (
    <div className="arch-wrap">
      <svg className="diagram" viewBox="0 0 720 240" role="img" aria-label={ARIA}>
        <defs>
          <marker id="archArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 8 4 0 8z" fill="var(--text-muted)" />
          </marker>
        </defs>
        <g stroke="var(--text-muted)" strokeWidth="1.2" fill="none">
          <line x1="156" y1="65" x2="188" y2="65" markerEnd="url(#archArrow)" />
          <line x1="336" y1="65" x2="368" y2="65" markerEnd="url(#archArrow)" />
          <line x1="516" y1="65" x2="548" y2="65" markerEnd="url(#archArrow)" />
          <line x1="626" y1="94" x2="626" y2="152" stroke="var(--info)" strokeDasharray="4 4" />
        </g>
        <Node x="16" y="36" w="140" h="58" title="Browser" sub="Owner console" />
        <Node x="196" y="36" w="140" h="58" title="HTTPS API" sub="TLS · owner only" tone="accent" />
        <Node x="376" y="36" w="140" h="58" title="Backend" sub="Node · Express" />
        <Node x="556" y="36" w="140" h="58" title="MongoDB" sub="members · ledger" />
        <Node x="556" y="152" w="140" h="52" title="Backup node" sub="nightly dump" />
        <text x="636" y="128" fontSize="8.5" fill="var(--info)">
          nightly
        </text>
        <text x="16" y="128" fontSize="8.5" fill="var(--text-muted)">
          No customer login. No customer-facing app.
        </text>
        <text x="16" y="146" fontSize="8.5" fill="var(--text-muted)">
          Payments are recorded by hand, never processed here.
        </text>
      </svg>
      <div className="diagram-legend">
        <span><i style={{ borderColor: "var(--text-muted)" }} />Solid: request path</span>
        <span><i style={{ borderColor: "var(--info)", borderStyle: "dashed" }} />Dashed: backup copy</span>
      </div>
    </div>
  );
}