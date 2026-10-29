import { useEffect, useState } from "react";
import ThemeSwitch from "./ThemeSwitch.jsx";
import { useData } from "../../context/DataContext.jsx";
import { OWNER, TZ_LABEL } from "../../data/config.js";
import { TODAY, fmtLong, clockLabel } from "../../lib/dates.js";

/** Sticky top bar: menu button (mobile), gym name, theme switch, clock, avatar. */
export default function Topbar({ navOpen, onOpenMenu }) {
  const { gym } = useData();
  const [now, setNow] = useState(() => fmtLong(TODAY) + " · " + clockLabel() + " · " + TZ_LABEL);

  useEffect(() => {
    const tick = () => setNow(fmtLong(TODAY) + " · " + clockLabel() + " · " + TZ_LABEL);
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <button
        className="menu-btn"
        type="button"
        aria-label="Open navigation"
        aria-expanded={navOpen}
        aria-controls="shell"
        onClick={onOpenMenu}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <span className="topbar-gym">{gym.name}</span>
      <div className="theme-slot">
        <ThemeSwitch variant="topbar" />
      </div>
      <div className="topbar-meta">
        <span className="tag">Sample data</span>
        <span className="clock">{now}</span>
        <span className="avatar" aria-hidden="true" title={OWNER.name + ", " + OWNER.role}>
          {OWNER.initials}
        </span>
      </div>
    </header>
  );
}