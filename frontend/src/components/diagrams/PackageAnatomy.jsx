const NODES = [
  { kicker: "Price", value: "e.g. $120", sub: "Charged once, recorded in the payment ledger" },
  { kicker: "Validity period", value: "e.g. 3 months", sub: "Counted in days, weeks, months or years" },
  { kicker: "Session allowance", value: "e.g. 10 sessions", sub: "Deducted one at a time at attendance" },
];

/** How a package combines price, validity and session allowance into a membership. */
export default function PackageAnatomy() {
  return (
    <section className="pkg-anatomy" aria-labelledby="pkg-anatomy-title">
      <div className="pkg-anatomy-head">
        <h2 className="pkg-anatomy-title" id="pkg-anatomy-title">
          Package anatomy
        </h2>
        <p className="chart-caption">A price plus its terms. The type decides which terms apply.</p>
      </div>
      <div className="pkg-anatomy-flow">
        {NODES.map((n, i) => (
          <>
            <div className="pa-node" key={"n" + i}>
              <p className="pa-kicker">{n.kicker}</p>
              <p className="pa-value">{n.value}</p>
              <p className="pa-sub">{n.sub}</p>
            </div>
            <span className="pa-arrow" aria-hidden="true" key={"a" + i} />
          </>
        ))}
        <div className="pa-node is-target">
          <p className="pa-kicker">Membership</p>
          <p className="pa-value">A member’s terms</p>
          <p className="pa-sub">Starts on the start date and keeps its terms for its whole life</p>
        </div>
      </div>
      <p className="chart-caption" style={{ marginTop: 10 }}>
        Time-based packages use validity. Session-based packages use an allowance. Both uses validity and an allowance.
        A package never stores the member — the membership does.
      </p>
    </section>
  );
}