/** KPI cell for the instrument-panel strip on Dashboard and Reports. */
export default function KpiCard({ label, value, meta, spark, tone, className = "" }) {
  return (
    <div className={"kpi " + className}>
      <span className="kpi-label">{label}</span>
      <span className={"kpi-value" + (tone ? " " + tone : "")}>{value}</span>
      <span className="kpi-foot">
        <span className="kpi-meta">{meta}</span>
        {spark}
      </span>
    </div>
  );
}