import { money } from "../../lib/money.js";

/** Cash received against outstanding balance. Collected total sits in the centre. */
export default function RevenueDonut({ collected = 0, outstanding = 0 }) {
  const total = collected + outstanding;
  const cShare = total > 0 ? collected / total : 0;
  const oShare = total > 0 ? outstanding / total : 0;
  const C = 2 * Math.PI * 68;
  const aria = "Cash received " + money(collected) + " against " + money(outstanding) + " outstanding.";
  return (
    <div className="donut-figure" role="img" aria-label={aria}>
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <circle cx="84" cy="84" r="68" fill="none" stroke="var(--border)" strokeWidth="14" opacity=".55" />
        {oShare > 0 && (
          <circle
            cx="84"
            cy="84"
            r="68"
            fill="none"
            stroke="var(--danger)"
            strokeWidth="14"
            opacity=".62"
            strokeDasharray={Math.max(1, oShare * C - 3) + " " + C}
            strokeDashoffset={-cShare * C}
            transform="rotate(-90 84 84)"
          />
        )}
        {cShare > 0 && (
          <circle
            className="donut-arc"
            cx="84"
            cy="84"
            r="68"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="14"
            strokeDasharray={Math.max(1, cShare * C - 3) + " " + C}
            transform="rotate(-90 84 84)"
          />
        )}
      </svg>
      <div className="donut-center">
        <span className="amount">{money(collected)}</span>
        <span className="cap">Collected</span>
      </div>
    </div>
  );
}