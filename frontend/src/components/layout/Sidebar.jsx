import { NavLink, useNavigate } from "react-router-dom";
import Icon, { BRAND_MARK } from "../ui/Icon.jsx";
import ThemeSwitch from "./ThemeSwitch.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useData } from "../../context/DataContext.jsx";
import { OWNER } from "../../data/config.js";

const NAV = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/customers", label: "Customers", icon: "customers", count: true },
  { to: "/packages", label: "Packages", icon: "package" },
  { to: "/attendance", label: "Attendance", icon: "attendance" },
  { to: "/reports", label: "Reports", icon: "reports" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

/** Primary navigation: a 240px rail on desktop, an off-canvas drawer on mobile. */
export default function Sidebar({ onNavigate }) {
  const { user, signOut } = useAuth();
  const { customers } = useData();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  const ownerName = user?.name || OWNER.name;
  const ownerInitials = user?.initials || OWNER.initials;
  const ownerRole = user?.role || OWNER.role;

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-head">
        <NavLink to="/" className="brand" aria-label="BGMS dashboard" onClick={onNavigate}>
          <span className="brand-mark">{BRAND_MARK}</span>
          <span>
            <span className="brand-name">BGMS</span>
            <span className="brand-sub">Foundry Boxing</span>
          </span>
        </NavLink>
      </div>
      <nav className="nav" aria-label="Sections">
        <p className="label nav-label">Console</p>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => "nav-link" + (isActive ? " is-active" : "")}
            onClick={onNavigate}
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.count && <span className="nav-count">{customers.length}</span>}
                {isActive && <span className="sr-only">current page</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <ThemeSwitch variant="drawer" />
        <div className="owner">
          <span className="avatar" aria-hidden="true">
            {ownerInitials}
          </span>
          <span>
            <span className="owner-name">{ownerName}</span>
            <span className="owner-role" style={{ display: "block" }}>
              {ownerRole} · only account
            </span>
          </span>
        </div>
        <button className="btn btn-ghost btn-sm signout" type="button" onClick={handleSignOut}>
          <Icon name="signout" />
          Sign out
        </button>
      </div>
    </aside>
  );
}