const KPI_TILES = { dashboard: 6, default: 4 };

/** Loading skeleton shown the first time a route opens. */
export default function Skeleton({ name = "default" }) {
  const tiles = KPI_TILES[name] || KPI_TILES.default;
  const kpis = Array.from({ length: tiles }, (_, i) => (
    <div key={i}>
      <div className="skel skel-line" style={{ width: "64%", height: 9 }} />
      <div className="skel skel-line" style={{ width: "48%", height: 24, marginTop: 14 }} />
      <div className="skel skel-line" style={{ width: "78%", height: 8, marginTop: 16 }} />
    </div>
  ));
  return (
    <div aria-busy="true" aria-label={"Loading " + name + " screen"}>
      <div className="skel skel-line" style={{ width: 220, height: 28 }} />
      <div className="skel skel-line" style={{ width: 340, height: 11, marginTop: 12 }} />
      <div className="skel-kpi" style={{ marginTop: 24, gridTemplateColumns: "repeat(" + Math.min(tiles, 4) + ",1fr)" }}>
        {kpis}
      </div>
      <div className="skel-card">
        <div className="skel skel-line" style={{ width: "180px", height: 14 }} />
        <div className="skel-row">
          <div className="skel skel-line" style={{ width: "90%", margin: 0 }} />
          <div className="skel skel-line" style={{ width: "70%", margin: 0 }} />
          <div className="skel skel-line" style={{ width: "100%", margin: 0 }} />
          <div className="skel skel-line" style={{ width: "80%", margin: 0 }} />
        </div>
        <div className="skel-row">
          <div className="skel skel-line" style={{ width: "70%", margin: 0 }} />
          <div className="skel skel-line" style={{ width: "90%", margin: 0 }} />
          <div className="skel skel-line" style={{ width: "60%", margin: 0 }} />
          <div className="skel skel-line" style={{ width: "100%", margin: 0 }} />
        </div>
      </div>
      <div className="skel-card" style={{ height: 170 }} />
    </div>
  );
}