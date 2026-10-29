import { TODAY, addDaysISO, fmtDate } from "../../lib/dates.js";
import { validityLabel, packageDays } from "../../data/packages.js";

const hasTime = (d) => d && (d.type === "time" || d.type === "both");
const hasSessions = (d) => d && (d.type === "session" || d.type === "both");

/** Live membership preview: a validity bar, session blocks, or both. */
export default function MembershipPreview({ draft }) {
  if (!draft || !draft.type) {
    return <p className="pkg-preview-note">Choose a package type to preview its membership timeline.</p>;
  }
  const parts = [];

  if (hasTime(draft)) {
    const n = Number(draft.validity && draft.validity.n);
    const unit = draft.validity && draft.validity.unit;
    const days = packageDays(draft);
    if (!isFinite(n) || n < 1 || n > 365 || days < 1) {
      parts.push(<p className="pkg-preview-note" key="time-err">Enter a validity period from 1 to 365 to draw the timeline.</p>);
    } else {
      const mid = addDaysISO(TODAY, Math.round(days / 2));
      parts.push(
        <div key="time">
          <div className="pkg-bar-wrap">
            <div className="pkg-bar">
              <i style={{ width: "100%" }} />
            </div>
            <div className="pkg-bar-ticks">
              <span>Start · {fmtDate(TODAY)}</span>
              <span>{fmtDate(mid)}</span>
              <span>Expiry · {fmtDate(addDaysISO(TODAY, days))}</span>
            </div>
          </div>
          <p className="pkg-preview-note">
            Valid for {validityLabel(n, unit)}. Expiry is calculated from the start date using the gym’s counting rule.
          </p>
        </div>,
      );
    }
  }

  if (hasSessions(draft)) {
    const n = Number(draft.sessions);
    if (!isFinite(n) || Math.floor(n) !== n || n < 1 || n > 500) {
      parts.push(<p className="pkg-preview-note" key="sess-err">Enter a session allowance from 1 to 500 to draw the session blocks.</p>);
    } else {
      const shown = Math.min(n, 20);
      const blocks = Array.from({ length: shown }, (_, i) => (
        <span className="pkg-session" aria-hidden="true" key={i} />
      ));
      parts.push(
        <div key="sessions">
          <div className="pkg-sessions" aria-hidden="true">
            {blocks}
            {n > shown && <span className="pkg-session-more">+{n - shown} more</span>}
          </div>
          <p className="pkg-preview-note">
            {n} session{n === 1 ? "" : "s"} included. Each attendance deducts one.
          </p>
        </div>,
      );
    }
  }

  return <>{parts}</>;
}