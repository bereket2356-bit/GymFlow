import { useTheme } from "../../context/ThemeContext.jsx";
import Icon from "../ui/Icon.jsx";

const OPTIONS = [
  { key: "light", label: "Light", icon: "sun" },
  { key: "dark", label: "Dark", icon: "moon" },
  { key: "system", label: "System", icon: "monitor" },
];

/**
 * Theme control: three icon+label choices, Light / Dark / System.
 * `variant="topbar"` stays visible on desktop, `variant="drawer"` inside the
 * mobile menu drawer. The choice lives in memory only.
 */
export default function ThemeSwitch({ variant = "topbar" }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={"theme-seg theme-" + variant} role="group" aria-label="Theme">
      <span className="theme-seg-label">Theme</span>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          className="theme-opt"
          type="button"
          aria-pressed={theme === o.key}
          onClick={() => setTheme(o.key)}
        >
          <Icon name={o.icon} />
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}