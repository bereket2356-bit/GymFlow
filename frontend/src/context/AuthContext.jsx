import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../lib/api.js";
import { OWNER } from "../data/config.js";

const AuthContext = createContext(null);

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function formatOwner(raw) {
  if (!raw) return null;
  const name = raw.name || OWNER.name;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || OWNER.initials;

  return {
    ...raw,
    name,
    initials,
    role: raw.role || OWNER.role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on initial mount / reload
  useEffect(() => {
    let mounted = true;
    api.auth
      .me()
      .then((res) => {
        if (mounted && res?.data?.owner) {
          setUser(formatOwner(res.data.owner));
        }
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const errors = {};
    const mail = String(email || "").trim();
    const pass = String(password || "");
    if (!mail || !EMAIL_RE.test(mail)) {
      errors.email = "Enter a valid email address.";
    }
    if (pass.length < 6) {
      errors.password = "Passwords are at least 6 characters.";
    }
    if (Object.keys(errors).length) return { ok: false, errors };

    try {
      const res = await api.auth.login(mail, pass);
      const owner = formatOwner(res?.data?.owner);
      setUser(owner);
      return { ok: true, owner, errors: {} };
    } catch (err) {
      const msg = err.message || "Invalid email or password.";
      return { ok: false, errors: { email: msg } };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
