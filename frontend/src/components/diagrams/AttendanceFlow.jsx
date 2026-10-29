const STEPS = [
  ["01", "Mark present or late"],
  ["02", "Session deducted once"],
  ["03", "Sessions left updated"],
  ["04", "Low-session reminder at 0"],
];

const ARIA =
  "Attendance to session flow: mark present or late, deduct one session once, update sessions left, raise an " +
  "internal low-session reminder at zero. No message is sent to the customer.";

function Node({ step }) {
  return (
    <div className="flow-node">
      <span className="fl-k">{step[0]}</span>
      <p className="fl-t">{step[1]}</p>
    </div>
  );
}

function Link() {
  return (
    <span className="flow-link" aria-hidden="true">
      <svg viewBox="0 0 38 10">
        <line className="flow-dash" x1="1" y1="5" x2="29" y2="5" />
        <polygon points="28,2 35,5 28,8" fill="var(--accent)" />
      </svg>
    </span>
  );
}

function VerticalLink() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }} aria-hidden="true">
      <svg viewBox="0 0 10 20" width="10" height="20">
        <line className="flow-dash" x1="5" y1="0" x2="5" y2="13" />
        <polygon points="2,12 5,19 8,12" fill="var(--accent)" />
      </svg>
    </div>
  );
}

/** Attendance → deduction → reminder flow. Animated connectors respect reduced motion. */
export default function AttendanceFlow() {
  return (
    <div role="img" aria-label={ARIA}>
      <div
        className="flow flow-horizontal"
        style={{ gridTemplateColumns: "minmax(0,1fr) 38px minmax(0,1fr) 38px minmax(0,1fr) 38px minmax(0,1fr)" }}
      >
        {STEPS.map((s, i) => (
          <Fragmentish key={s[0]}>
            <Node step={s} />
            {i < STEPS.length - 1 && <Link />}
          </Fragmentish>
        ))}
      </div>
      <div className="flow-vertical">
        {STEPS.map((s, i) => (
          <Fragmentish key={s[0]}>
            <Node step={s} />
            {i < STEPS.length - 1 && <VerticalLink />}
          </Fragmentish>
        ))}
      </div>
      <p className="chart-caption">
        One deduction per marked session. A pack at zero raises an internal reminder on the dashboard — no message is
        sent to the customer.
      </p>
    </div>
  );
}

/** Spreads siblings without introducing a wrapper element. */
function Fragmentish({ children }) {
  return <>{children}</>;
}