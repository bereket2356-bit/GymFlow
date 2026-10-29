const TONE = { accent: "var(--accent)", danger: "var(--danger)", warning: "var(--warning)", muted: "var(--text-muted)" };

/** Small trend line used inside KPI cells. */
export default function Sparkline({ values, tone = "muted", label }) {
  const vals = values && values.length ? values : [1, 1, 1, 1];
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = Math.max(1, max - min);
  const pts = vals
    .map((v, i) => {
      const x = 2 + (i * 54) / Math.max(1, vals.length - 1);
      const y = 18 - ((v - min) / span) * 14;
      return x + "," + y;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 58 20" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}>
      <polyline
        points={pts}
        fill="none"
        stroke={TONE[tone] || TONE.muted}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}