import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/ui/Icon.jsx";
import Modal from "../components/ui/Modal.jsx";
import Button from "../components/ui/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { TZ_LABEL } from "../data/config.js";

function computeInitials(name, displayName) {
  const target = (displayName && displayName.trim()) || (name && name.trim()) || "";
  const parts = target.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function evaluatePassword(currentPassword, newPassword, confirmPassword) {
  const hasLength = (newPassword || "").length >= 12;
  const hasLetter = /[a-zA-Z]/.test(newPassword || "");
  const hasNumber = /\d/.test(newPassword || "");
  const differs = Boolean(newPassword && currentPassword && newPassword !== currentPassword);
  const matches = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  const allPass = hasLength && hasLetter && hasNumber && differs && matches;

  let score = 0;
  if ((newPassword || "").length >= 12) score += 1;
  if ((newPassword || "").length >= 16) score += 1;
  if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score += 1;
  if (/\d/.test(newPassword)) score += 1;
  if (/[^a-zA-Z0-9]/.test(newPassword)) score += 1;

  let strengthLabel = "Weak";
  let strengthColor = "var(--danger, #f43f5e)";
  let strengthPercent = 25;

  if (score >= 4) {
    strengthLabel = "Strong";
    strengthColor = "var(--success, #10b981)";
    strengthPercent = 100;
  } else if (score >= 3) {
    strengthLabel = "Good";
    strengthColor = "var(--info, #38bdf8)";
    strengthPercent = 75;
  } else if (score >= 2 && hasLength) {
    strengthLabel = "Fair";
    strengthColor = "var(--warning, #f59e0b)";
    strengthPercent = 50;
  } else if (newPassword) {
    strengthLabel = "Weak";
    strengthColor = "var(--danger, #f43f5e)";
    strengthPercent = 25;
  } else {
    strengthLabel = "";
    strengthPercent = 0;
  }

  return {
    rules: {
      hasLength,
      hasLetter,
      hasNumber,
      differs,
      matches,
    },
    allPass,
    strengthLabel,
    strengthColor,
    strengthPercent,
  };
}

export default function Settings() {
  const { user, updateProfile, signOutAll } = useAuth();
  const { gym, updateGym } = useData();
  const { push } = useToast();
  const navigate = useNavigate();

  // 1. Profile State
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    displayName: user?.displayName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentPassword: "",
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);

  // Sync profile form when user object updates
  useEffect(() => {
    if (user) {
      setProfileForm((prev) => ({
        ...prev,
        name: user.name || "",
        displayName: user.displayName || "",
        email: user.email || "",
        phone: user.phone || "",
      }));
    }
  }, [user]);

  const isProfileDirty = useMemo(() => {
    if (!user) return false;
    return (
      profileForm.name !== (user.name || "") ||
      profileForm.displayName !== (user.displayName || "") ||
      profileForm.email !== (user.email || "") ||
      profileForm.phone !== (user.phone || "")
    );
  }, [profileForm, user]);

  const emailChanged = useMemo(() => {
    if (!user) return false;
    return profileForm.email.trim().toLowerCase() !== (user.email || "").toLowerCase();
  }, [profileForm.email, user]);

  // Unsaved changes warning
  useEffect(() => {
    if (!isProfileDirty) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isProfileDirty]);

  const handleProfileReset = () => {
    if (!user) return;
    setProfileForm({
      name: user.name || "",
      displayName: user.displayName || "",
      email: user.email || "",
      phone: user.phone || "",
      currentPassword: "",
    });
    setProfileErrors({});
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (profileSaving) return;

    const errors = {};
    const nameTrimmed = profileForm.name.trim();
    if (nameTrimmed.length < 2 || nameTrimmed.length > 80) {
      errors.name = "Full name must be between 2 and 80 characters.";
    }

    if (profileForm.displayName && profileForm.displayName.trim().length > 40) {
      errors.displayName = "Display name cannot exceed 40 characters.";
    }

    const emailTrimmed = profileForm.email.trim();
    if (!emailTrimmed || !/^\S+@\S+\.\S+$/.test(emailTrimmed)) {
      errors.email = "Enter a valid email address.";
    }

    if (profileForm.phone) {
      const phoneTrimmed = profileForm.phone.trim();
      if (!/^[\d\s\-()+]{7,20}$/.test(phoneTrimmed)) {
        errors.phone = "Phone must be 7 to 20 characters (digits, spaces, dashes, parentheses, plus).";
      }
    }

    if (emailChanged && !profileForm.currentPassword) {
      errors.currentPassword = "Enter your current password to change email.";
    }

    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setProfileSaving(true);
    try {
      const payload = {
        name: nameTrimmed,
        displayName: profileForm.displayName.trim() || null,
        email: emailTrimmed,
        phone: profileForm.phone.trim() || null,
      };
      if (emailChanged) {
        payload.currentPassword = profileForm.currentPassword;
      }

      await updateProfile(payload);
      setProfileForm((prev) => ({ ...prev, currentPassword: "" }));
      push("Profile updated successfully.");
    } catch (err) {
      const code = err.data?.error?.code || err.code;
      if (code === "EMAIL_TAKEN") {
        setProfileErrors((prev) => ({ ...prev, email: "This email address is already in use." }));
      } else if (err.status === 401 || err.message?.includes("password")) {
        setProfileErrors((prev) => ({ ...prev, currentPassword: "Current password is incorrect." }));
      } else {
        setProfileErrors((prev) => ({ ...prev, general: err.message || "Failed to update profile." }));
      }
    } finally {
      setProfileSaving(false);
    }
  };

  // 2. Password State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  const passwordEval = useMemo(
    () => evaluatePassword(passwordForm.currentPassword, passwordForm.newPassword, passwordForm.confirmPassword),
    [passwordForm],
  );

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordEval.allPass || passwordUpdating) return;

    setPasswordUpdating(true);
    setPasswordError("");

    try {
      await api.auth.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      push("Password updated.");
    } catch (err) {
      setPasswordError(err.message || "Failed to update password. Check your current password.");
    } finally {
      setPasswordUpdating(false);
    }
  };

  // 3. Sessions State
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [sessionPassword, setSessionPassword] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionSubmitting, setSessionSubmitting] = useState(false);

  const handleSignOutAll = async (e) => {
    e.preventDefault();
    if (!sessionPassword || sessionSubmitting) return;

    setSessionSubmitting(true);
    setSessionError("");

    try {
      await signOutAll(sessionPassword);
      setShowSignOutModal(false);
      push("Signed out of all devices.");
      navigate("/signin", { replace: true });
    } catch (err) {
      setSessionError(err.message || "Incorrect password. Could not sign out of other devices.");
      setSessionSubmitting(false);
    }
  };

  // 4. Gym Form State
  const [gymForm, setGymForm] = useState({
    name: gym.name,
    warn7: String(gym.warn7),
    warn3: String(gym.warn3),
    warn1: String(gym.warn1),
    inactive: String(gym.inactive),
  });
  const [gymErrors, setGymErrors] = useState({});

  const setGymField = (patch) => setGymForm((f) => ({ ...f, ...patch }));

  const handleGymSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    const w7 = parseInt(gymForm.warn7, 10);
    const w3 = parseInt(gymForm.warn3, 10);
    const w1 = parseInt(gymForm.warn1, 10);
    const inactive = parseInt(gymForm.inactive, 10);

    if (gymForm.name.trim().length < 2) next.name = "Enter the gym name.";
    [w7, w3, w1].forEach((v, i) => {
      if (!isFinite(v) || v < 1 || v > 30) {
        next[["warn7", "warn3", "warn1"][i]] = "Use a number between 1 and 30 days.";
      }
    });
    if (isFinite(w7) && isFinite(w3) && isFinite(w1) && !(w7 >= w3 && w3 >= w1)) {
      next.warn7 = "Windows must run from the widest to the tightest: first ≥ second ≥ final.";
    }
    if (!isFinite(inactive) || inactive < 1 || inactive > 90) {
      next.inactive = "Use a number between 1 and 90 days.";
    }
    setGymErrors(next);
    if (Object.keys(next).length) return;

    await updateGym({
      name: gymForm.name.trim(),
      warn7: w7,
      warn3: w3,
      warn1: w1,
      inactive,
    });
    push("Settings saved. Expiry windows are " + w7 + ", " + w3 + " and " + w1 + " days.");
  };

  const previewInitials = computeInitials(profileForm.name, profileForm.displayName);

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Settings</h1>
          <p className="page-meta">
            <span>Owner console</span>
            <span className="dot-sep" />
            <span>{TZ_LABEL}</span>
          </p>
        </div>
      </div>

      {/* SECTION 1: PROFILE & ACCOUNT (First Section) */}
      <div className="settings-grid" style={{ marginBottom: 24 }}>
        {/* Card 1: Profile Details */}
        <section className="card" aria-labelledby="profile-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="profile-title">Owner profile</h2>
              <p className="card-sub">Manage your account information and console identity.</p>
            </div>
          </div>
          <form onSubmit={handleProfileSubmit} noValidate>
            <div className="card-body">
              {profileErrors.general && (
                <div className="callout callout--danger" style={{ marginBottom: 16 }} role="alert">
                  <span>{profileErrors.general}</span>
                </div>
              )}

              {/* Avatar Preview */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div
                  className="avatar lg"
                  style={{
                    width: 52,
                    height: 52,
                    fontSize: 20,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    background: "var(--accent, #f59e0b)",
                    color: "#000",
                    userSelect: "none",
                  }}
                  aria-label={"Avatar preview " + previewInitials}
                >
                  {previewInitials || "—"}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>
                    {profileForm.displayName || profileForm.name || "Owner"}
                  </p>
                  <p className="field-hint" style={{ margin: "2px 0 0" }}>
                    Initials preview ({previewInitials}) · generated automatically
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field span-2">
                  <label className="label" htmlFor="profile-name">
                    Full name <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    className={"input" + (profileErrors.name ? " has-error" : "")}
                    id="profile-name"
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  {profileErrors.name && (
                    <p className="field-error" role="alert">{profileErrors.name}</p>
                  )}
                </div>

                <div className="field span-2">
                  <label className="label" htmlFor="profile-displayName">
                    Display name <span className="field-hint" style={{ display: "inline" }}>(optional, up to 40 chars)</span>
                  </label>
                  <input
                    className={"input" + (profileErrors.displayName ? " has-error" : "")}
                    id="profile-displayName"
                    type="text"
                    maxLength={40}
                    placeholder={profileForm.name ? profileForm.name.split(" ")[0] : "Nickname"}
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
                  />
                  {profileErrors.displayName && (
                    <p className="field-error" role="alert">{profileErrors.displayName}</p>
                  )}
                  <p className="field-hint">Used in headers, greetings, and avatar initials.</p>
                </div>

                <div className="field span-2">
                  <label className="label" htmlFor="profile-email">
                    Email address <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    className={"input" + (profileErrors.email ? " has-error" : "")}
                    id="profile-email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  {profileErrors.email && (
                    <p className="field-error" role="alert">{profileErrors.email}</p>
                  )}
                </div>

                {emailChanged && (
                  <div className="field span-2" style={{ background: "var(--bg-subtle)", padding: 12, borderRadius: 6 }}>
                    <label className="label" htmlFor="profile-currentPassword">
                      Current password <span style={{ color: "var(--danger)" }}>* required to change email</span>
                    </label>
                    <input
                      className={"input" + (profileErrors.currentPassword ? " has-error" : "")}
                      id="profile-currentPassword"
                      type="password"
                      placeholder="Enter your current password"
                      value={profileForm.currentPassword}
                      onChange={(e) => setProfileForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    />
                    {profileErrors.currentPassword && (
                      <p className="field-error" role="alert">{profileErrors.currentPassword}</p>
                    )}
                  </div>
                )}

                <div className="field span-2">
                  <label className="label" htmlFor="profile-phone">
                    Phone number <span className="field-hint" style={{ display: "inline" }}>(optional)</span>
                  </label>
                  <input
                    className={"input" + (profileErrors.phone ? " has-error" : "")}
                    id="profile-phone"
                    type="tel"
                    placeholder="+251 911 000 000"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  {profileErrors.phone && (
                    <p className="field-error" role="alert">{profileErrors.phone}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="card-foot" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button
                type="button"
                variant="secondary"
                disabled={!isProfileDirty || profileSaving}
                onClick={handleProfileReset}
              >
                Discard changes
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!isProfileDirty || profileSaving}
              >
                {profileSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </section>

        {/* Column 2: Password and Sessions */}
        <div className="stack">
          {/* Card 2: Change Password */}
          <section className="card" aria-labelledby="pwd-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="pwd-title">Change password</h2>
                <p className="card-sub">Ensure your account uses a strong, complex password.</p>
              </div>
            </div>
            <form onSubmit={handlePasswordSubmit} noValidate>
              <div className="card-body">
                {passwordError && (
                  <div className="callout callout--danger" style={{ marginBottom: 14 }} role="alert">
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="field" style={{ marginBottom: 14 }}>
                  <label className="label" htmlFor="pwd-current">Current password</label>
                  <input
                    className="input"
                    id="pwd-current"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  />
                </div>

                <div className="field" style={{ marginBottom: 14 }}>
                  <label className="label" htmlFor="pwd-new">New password</label>
                  <input
                    className="input"
                    id="pwd-new"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                  />
                </div>

                {/* Password Strength Indicator */}
                {passwordForm.newPassword && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span className="field-hint">Password strength</span>
                      <strong style={{ color: passwordEval.strengthColor }}>{passwordEval.strengthLabel}</strong>
                    </div>
                    <div
                      style={{
                        height: 4,
                        width: "100%",
                        background: "var(--border-subtle, #333)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${passwordEval.strengthPercent}%`,
                          background: passwordEval.strengthColor,
                          transition: "width 0.2s ease, background 0.2s ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="field" style={{ marginBottom: 14 }}>
                  <label className="label" htmlFor="pwd-confirm">Confirm new password</label>
                  <input
                    className="input"
                    id="pwd-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  />
                </div>

                {/* Live Checklist */}
                <div style={{ background: "var(--bg-subtle)", padding: 12, borderRadius: 6, fontSize: 12 }}>
                  <span className="label" style={{ marginBottom: 6, display: "block" }}>Password requirements:</span>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    <li style={{ display: "flex", alignItems: "center", gap: 6, color: passwordEval.rules.hasLength ? "var(--success)" : "var(--text-muted)" }}>
                      <span>{passwordEval.rules.hasLength ? "✓" : "○"}</span> At least 12 characters
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: 6, color: passwordEval.rules.hasLetter ? "var(--success)" : "var(--text-muted)" }}>
                      <span>{passwordEval.rules.hasLetter ? "✓" : "○"}</span> At least one letter
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: 6, color: passwordEval.rules.hasNumber ? "var(--success)" : "var(--text-muted)" }}>
                      <span>{passwordEval.rules.hasNumber ? "✓" : "○"}</span> At least one number
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: 6, color: passwordEval.rules.differs ? "var(--success)" : "var(--text-muted)" }}>
                      <span>{passwordEval.rules.differs ? "✓" : "○"}</span> Differs from current password
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: 6, color: passwordEval.rules.matches ? "var(--success)" : "var(--text-muted)" }}>
                      <span>{passwordEval.rules.matches ? "✓" : "○"}</span> Passwords match
                    </li>
                  </ul>
                </div>
              </div>
              <div className="card-foot" style={{ justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!passwordEval.allPass || passwordUpdating}
                >
                  {passwordUpdating ? "Updating…" : "Update password"}
                </Button>
              </div>
            </form>
          </section>

          {/* Card 3: Sessions */}
          <section className="card" aria-labelledby="sessions-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="sessions-title">Active sessions</h2>
                <p className="card-sub">You are signed in on this device.</p>
              </div>
            </div>
            <div className="card-body">
              <p className="field-hint" style={{ margin: 0 }}>
                If you lost a device or suspect unauthorized access, you can terminate all signed-in sessions across every computer, tablet, and phone.
              </p>
            </div>
            <div className="card-foot" style={{ justifyContent: "flex-end" }}>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setSessionPassword("");
                  setSessionError("");
                  setShowSignOutModal(true);
                }}
              >
                Sign out of all sessions
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* SECTION 2: GYM DETAILS */}
      <div className="settings-grid">
        <section className="card" aria-labelledby="gym-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="gym-title">Gym details</h2>
              <p className="card-sub">Used across the console and in exported reports.</p>
            </div>
          </div>
          <form onSubmit={handleGymSubmit} noValidate>
            <div className="card-body">
              <div className="form-grid">
                <div className="field span-2">
                  <label className="label" htmlFor="set-name">Gym name</label>
                  <input
                    className={"input" + (gymErrors.name ? " has-error" : "")}
                    id="set-name"
                    value={gymForm.name}
                    aria-invalid={gymErrors.name ? "true" : undefined}
                    onChange={(e) => setGymField({ name: e.target.value })}
                  />
                  {gymErrors.name && <p className="field-error" role="alert">{gymErrors.name}</p>}
                </div>
                <div className="field">
                  <label className="label" htmlFor="set-currency">Currency</label>
                  <select className="select" id="set-currency" value={gym.currency || "$"} disabled>
                    <option value={gym.currency || "$"}>{gym.currency || "$"}</option>
                  </select>
                  <p className="field-hint">Configured on the gym server.</p>
                </div>
                <div className="field">
                  <label className="label" htmlFor="set-tz">Timezone</label>
                  <select className="select" id="set-tz" value={TZ_LABEL} disabled>
                    <option>{TZ_LABEL}</option>
                  </select>
                  <p className="field-hint">All dates and session times use this timezone.</p>
                </div>
                <div className="field span-2">
                  <span className="label">Date-counting rule</span>
                  <div className="pkg-readonly">
                    <span className="lock-label"><Icon name="lock" />Read-only</span>
                    <p>
                      <strong>{gym.dateCounting}.</strong> Membership expiry is counted from the start date.
                    </p>
                  </div>
                </div>
                <div className="field span-2">
                  <span className="label">Expiry warning windows</span>
                  <div className="warn-grid">
                    <div className="field">
                      <label className="field-hint" htmlFor="set-warn7">First warning, days</label>
                      <input
                        className={"input mono" + (gymErrors.warn7 ? " has-error" : "")}
                        id="set-warn7"
                        inputMode="numeric"
                        value={gymForm.warn7}
                        onChange={(e) => setGymField({ warn7: e.target.value })}
                      />
                      {gymErrors.warn7 && <p className="field-error" role="alert">{gymErrors.warn7}</p>}
                    </div>
                    <div className="field">
                      <label className="field-hint" htmlFor="set-warn3">Second warning, days</label>
                      <input
                        className={"input mono" + (gymErrors.warn3 ? " has-error" : "")}
                        id="set-warn3"
                        inputMode="numeric"
                        value={gymForm.warn3}
                        onChange={(e) => setGymField({ warn3: e.target.value })}
                      />
                      {gymErrors.warn3 && <p className="field-error" role="alert">{gymErrors.warn3}</p>}
                    </div>
                    <div className="field">
                      <label className="field-hint" htmlFor="set-warn1">Final warning, days</label>
                      <input
                        className={"input mono" + (gymErrors.warn1 ? " has-error" : "")}
                        id="set-warn1"
                        inputMode="numeric"
                        value={gymForm.warn1}
                        onChange={(e) => setGymField({ warn1: e.target.value })}
                      />
                      {gymErrors.warn1 && <p className="field-error" role="alert">{gymErrors.warn1}</p>}
                    </div>
                  </div>
                  <p className="field-hint" style={{ marginTop: 6 }}>
                    Dashboard reminders use these windows, with the tightest one always winning.
                  </p>
                </div>
                <div className="field span-2">
                  <label className="label" htmlFor="set-inactive">Inactivity window, days</label>
                  <input
                    className={"input mono" + (gymErrors.inactive ? " has-error" : "")}
                    id="set-inactive"
                    inputMode="numeric"
                    value={gymForm.inactive}
                    onChange={(e) => setGymField({ inactive: e.target.value })}
                  />
                  {gymErrors.inactive && <p className="field-error" role="alert">{gymErrors.inactive}</p>}
                  <p className="field-hint">
                    A customer with no visit inside this window triggers an internal inactivity reminder.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-foot" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" type="submit">Save gym settings</button>
            </div>
          </form>
        </section>
      </div>

      {/* Confirmation Modal for Sign out of all sessions */}
      {showSignOutModal && (
        <Modal
          title="Sign out of all sessions?"
          sub="This will log you out across every browser and device."
          onClose={() => setShowSignOutModal(false)}
          footer={
            <>
              <Button onClick={() => setShowSignOutModal(false)} disabled={sessionSubmitting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!sessionPassword || sessionSubmitting}
                onClick={handleSignOutAll}
              >
                {sessionSubmitting ? "Signing out…" : "Sign out everywhere"}
              </Button>
            </>
          }
        >
          <div className="modal-body">
            <div className="callout callout--danger">
              <span>
                <strong>Security action:</strong> All active login tokens will be immediately invalidated. You will need to sign in again on this device.
              </span>
            </div>

            {sessionError && (
              <div className="callout callout--warning" style={{ marginTop: 12 }} role="alert">
                <span>{sessionError}</span>
              </div>
            )}

            <div className="field" style={{ marginTop: 16 }}>
              <label className="label" htmlFor="signout-all-password">
                Enter your current password to confirm
              </label>
              <input
                id="signout-all-password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={sessionPassword}
                autoFocus
                onChange={(e) => setSessionPassword(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
