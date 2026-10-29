import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { OWNER } from "../data/config.js";

const AuthContext = createContext(null);

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Owner sign-in state, in memory only — nothing is written to storage.
 * Any valid email and a password of 6+ characters is accepted (sample build).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const signIn = useCallback((email, password) => {
    const errors = {};
    const mail = String(email || "").trim();
    const pass = String(password || "");
    if (!mail || !EMAIL_RE.test(mail)) errors.email = "Enter a valid email address, like owner@foundry.boxing.";
    if (pass.length < 6) errors.password = "Passwords are at least 6 characters.";
    if (Object.keys(errors).length) return { ok: false, errors };
    setUser(OWNER);
    return { ok: true, errors: {} };
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}