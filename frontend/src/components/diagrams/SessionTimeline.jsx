import { pad2, timeToMin } from "../../lib/dates.js";

const START = 5 * 60;
const END = 21 * 60;
const SPAN = END - START;

/** Today’s session track from 05:00 to 21:00, sized by duration. */
export default function SessionTimeline({ sessions = [] }) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const aria =
    "Today’s session track from 05:00 to 21:00. " +
    sessions.map((s) => s.title + " at " + s.time + " is " + s.status.toLowerCase() + ".").join(" ");

  const hours = [];
  for (let h = 5; h <= 21; h += 2) hours.push(h);

  return (
    <div>
      <div className="tl-scroll">
        <div className="tl-inner">
          <div className="tl-track" role="img" aria-label={aria}>
            {hours.map((h) => (
              <span
                key={h}
                className="tl-gridline"
                style={{ left: (((h * 60 - START) / SPAN) * 100).toFixed(3) + "%" }}
              />
            ))}
            {nowMin >= START && nowMin <= END && (
              <span
                className="tl-now"
                style={{ left: (((nowMin - START) / SPAN) * 100).toFixed(3) + "%" }}
                title="Current time"
              />
            )}
            {sessions.map((s) => {
              const a = timeToMin(s.time);
              const b = timeToMin(s.end);
              const left = ((a - START) / SPAN) * 100;
              const width = Math.max(1.2, ((b - a) / SPAN) * 100);
              const cls =
                s.status === "Completed" ? "is-completed" : s.status === "Cancelled" ? "is-cancelled" : "is-planned";
              return (
                <div
                  key={s.id}
                  className={"tl-block " + cls}
                  style={{ left: left.toFixed(3) + "%", width: width.toFixed(3) + "%" }}
                  title={s.title + " · " + s.time + "–" + s.end + " · " + s.status}
                >
                  <span className="tb-time">{s.time}</span>
                  <span className="tb-title">{s.title}</span>
                </div>
              );
            })}
          </div>
          <div className="tl-hours" aria-hidden="true">
            {hours.map((h) => (
              <span key={h}>{pad2(h)}:00</span>
            ))}
          </div>
        </div>
      </div>
      <div className="tl-legend" aria-hidden="true">
        <span>
          <i className="swatch" style={{ borderColor: "var(--success)", background: "var(--tint-success)" }} />
          Completed
        </span>
        <span>
          <i className="swatch" style={{ borderColor: "var(--info)", background: "var(--tint-info)" }} />
          Planned
        </span>
        <span>
          <i className="swatch" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
          Cancelled
        </span>
      </div>
      <p className="chart-caption">Block length is the session duration. The accent line marks the current time.</p>
    </div>
  );
}