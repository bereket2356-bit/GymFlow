import { TODAY, parseISO, shiftISO, addDaysISO, fmtDate } from "../../lib/dates.js";

export function heatLevel(n) {
  if (n <= 0) return 0;
  if (n <= 3) return 1;
  if (n <= 6) return 2;
  if (n <= 9) return 3;
  return 4;
}

/** Four weeks of deterministic visit counts, Monday to Sunday. */
export function heatData() {
  const dow = (parseISO(TODAY).getDay() + 6) % 7;
  const monday = shiftISO(-dow);
  const start = addDaysISO(monday, -21);
  const cells = [];
  for (let i = 0; i < 28; i += 1) {
    const date = addDaysISO(start, i);
    const dd = parseISO(date);
    let count = 2 + ((dd.getDate() * 7 + (dd.getMonth() + 1) * 3 + dd.getDay()) % 9);
    if (dd.getDay() === 0 || dd.getDay() === 6) count += 2;
    if (date === TODAY) count = Math.max(count, 7);
    cells.push({ date, count, level: heatLevel(count) });
  }
  return cells;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEVEL_BG = ["var(--surface-2)", "14%", "30%", "65%", "var(--success)"];

/** Attendance heat map with visible counts, tooltips and a legend. */
export default function AttendanceHeatmap() {
  const cells = heatData();
  const busiest = [...cells].sort((a, b) => b.count - a.count)[0];
  const aria =
    "Attendance heat map for the four weeks to " +
    fmtDate(TODAY) +
    ". Busiest day: " +
    fmtDate(busiest.date) +
    " with " +
    busiest.count +
    " visits.";
  return (
    <div>
      <div className="heat" role="img" aria-label={aria}>
        {DAYS.map((d) => (
          <span className="heat-day" key={d}>
            {d}
          </span>
        ))}
        {cells.map((c) => (
          <span
            key={c.date}
            className="heat-cell"
            data-level={c.level}
            title={fmtDate(c.date) + " · " + c.count + " visits"}
          >
            {c.count}
          </span>
        ))}
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>Fewer</span>
        <span className="sw" style={{ background: LEVEL_BG[0] }} />
        <span
          className="sw"
          style={{
            background: "color-mix(in srgb, var(--success) " + LEVEL_BG[1] + ", transparent)",
            borderColor: "color-mix(in srgb, var(--success) 24%, var(--border))",
          }}
        />
        <span className="sw" style={{ background: "color-mix(in srgb, var(--success) " + LEVEL_BG[2] + ", transparent)" }} />
        <span className="sw" style={{ background: "color-mix(in srgb, var(--success) " + LEVEL_BG[3] + ", transparent)" }} />
        <span className="sw" style={{ background: LEVEL_BG[4] }} />
        <span>More · 0, 1–3, 4–6, 7–9, 10+ visits</span>
      </div>
    </div>
  );
}