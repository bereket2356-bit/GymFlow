import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const CHOICES = ["light", "dark", "system"];

/** Resolves the chosen theme against the device preference. Dark is the default. */
function resolve(theme, prefersDark) {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true,
  );

  // Follow the device setting while "System" is selected.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const resolved = resolve(theme, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    root.classList.add("theme-fade");
    const timer = setTimeout(() => root.classList.remove("theme-fade"), 230);
    return () => clearTimeout(timer);
  }, [resolved]);

  const choose = useCallback((choice) => {
    if (CHOICES.includes(choice)) setTheme(choice);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme: choose }), [theme, resolved, choose]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}