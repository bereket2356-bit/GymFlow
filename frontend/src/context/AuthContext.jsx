import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../lib/api.js";
import { OWNER } from "../data/config.js";

const AuthContext = createContext(null);

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function formatOwner(raw) {
  if (!raw) return null;
  const name = raw.name || OWNER.name;
  const displayName = raw.displayName || null;
  const effectiveName = displayName || name.split(/\s+/)[0] || name;
  const initials =
    raw.avatarInitials ||
    effectiveName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase() ||
    OWNER.initials;

  return {
    ...raw,
    name,
    displayName,
    effectiveName,
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
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data) => {
    const res = await api.auth.updateProfile(data);
    if (res?.data?.owner) {
      setUser(formatOwner(res.data.owner));
    }
    return res;
  }, []);

  const signOutAll = useCallback(async (currentPassword) => {
    const res = await api.auth.signOutAll({ currentPassword });
    setUser(null);
    return res;
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, updateProfile, signOutAll }),
    [user, loading, signIn, signOut, updateProfile, signOutAll],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
