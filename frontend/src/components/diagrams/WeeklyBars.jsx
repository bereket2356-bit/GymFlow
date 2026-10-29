import { money } from "../../lib/money.js";
import { fmtDate, fmtShort } from "../../lib/dates.js";

/** Eight-week cash-received bar chart with hover / focus tooltips. */
export default function WeeklyBars({ series = [] }) {
  const values = series.map((s) => s.value);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const aria =
    "Cash received by week for the last eight weeks. Total " +
    money(total) +
    ". Highest week " +
    money(max) +
    ".";
  return (
    <div>
      <div className="bars" role="img" aria-label={aria}>
        {series.map((s, i) => {
          const last = i === series.length - 1;
          const pct = Math.max(2, Math.round((s.value / max) * 100));
          return (
            <div
              key={s.to}
              className="bar-col"
              tabIndex={0}
              aria-label={"Week to " + fmtDate(s.to) + ": " + money(s.value)}
            >
              <span className="bar-tip" aria-hidden="true">
                {fmtShort(s.to) + " · " + money(s.value)}
              </span>
              <span
                className={"bar" + (last ? " is-current" : "")}
                style={{ height: pct + "%", animationDelay: i * 35 + "ms" }}
              />
            </div>
          );
        })}
      </div>
      <div className="bar-x" aria-hidden="true">
        {series.map((s) => (
          <span key={s.to}>{fmtShort(s.to)}</span>
        ))}
      </div>
      <p className="chart-caption">
        Seven-day blocks ending today. The lime bar is the current, partial week. Hover or focus a bar for the exact
        amount.
      </p>
    </div>
  );
}