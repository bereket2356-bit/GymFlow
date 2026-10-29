import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import MobileDrawer from "./MobileDrawer.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const TITLES = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/packages": "Packages",
  "/attendance": "Attendance",
  "/reports": "Reports",
  "/settings": "Settings",
  "/signin": "Sign in",
};

function routeKey(pathname) {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/customers/")) return "customer";
  return pathname.replace("/", "") || "dashboard";
}

function routeTitle(pathname) {
  if (pathname.startsWith("/customers/")) return "Customer";
  return TITLES[pathname] || "Not found";
}

/**
 * App shell: sidebar + topbar + routed page. The first time a route opens it
 * shows the loading skeleton for a beat, exactly like the prototype.
 */
export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    setNavOpen(false);
    document.title = routeTitle(location.pathname) + " — BGMS";
    const key = location.pathname;
    if (seen.current.has(key)) return undefined;
    seen.current.add(key);
    setPending(true);
    const timer = setTimeout(() => setPending(false), 430);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && navOpen) setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const openNav = () => setNavOpen(true);
  const closeNav = () => {
    setNavOpen(false);
    const menu = document.querySelector(".menu-btn");
    if (menu) menu.focus();
  };

  return (
    <div className={"shell" + (navOpen ? " nav-open" : "")} id="shell">
      <MobileDrawer open={navOpen} onClose={closeNav} />
      <Sidebar onNavigate={() => setNavOpen(false)} />
      <div className="main">
        <Topbar navOpen={navOpen} onOpenMenu={openNav} />
        <main className="view" id="view" tabIndex={-1}>
          {pending ? <Skeleton name={routeKey(location.pathname)} /> : <Outlet context={{ navigate, closeNav }} />}
        </main>
      </div>
    </div>
  );
}