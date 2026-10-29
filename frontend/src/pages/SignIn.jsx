import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BRAND_MARK } from "../components/ui/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { TZ_LABEL, OWNER } from "../data/config.js";

/**
 * Owner sign-in. Any valid email with a password of 6+ characters is accepted
 * in this sample build. State lives in memory only.
 */
export default function SignIn() {
  const { signIn } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("owner@foundry.boxing");
  const [password, setPassword] = useState("ringside");
  const [errors, setErrors] = useState({});
  const [forgot, setForgot] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const result = signIn(email, password);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    navigate("/", { replace: true });
    push("Signed in as " + OWNER.name + " — owner console.");
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-mark">{BRAND_MARK}</span>
          <div>
            <span className="auth-word">BGMS</span>
            <p className="auth-sub">Boxing Gym Management</p>
          </div>
        </div>
        <div className="auth-panel">
          <h1 className="auth-title">Sign in to the owner console</h1>
          <p className="auth-copy">One account. Customers never see this site.</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input
                className={"input" + (errors.email ? " has-error" : "")}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                aria-invalid={errors.email ? "true" : undefined}
                aria-describedby="email-error"
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="field-error" id="email-error" role="alert">{errors.email}</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <input
                className={"input" + (errors.password ? " has-error" : "")}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                aria-invalid={errors.password ? "true" : undefined}
                aria-describedby="password-hint password-error"
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="field-hint" id="password-hint">
                Sample build: any valid email and a password of 6 characters or more.
              </p>
              <p className="field-error" id="password-error" role="alert">{errors.password}</p>
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>
              Sign in
            </button>
          </form>
          <div className="auth-actions">
            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                setForgot("Password reset isn’t available in this build. Ask the system administrator to reset owner access.");
              }}
            >
              Forgot password?
            </a>
            <span className="label" style={{ fontSize: "9.5px" }}>Owner access only</span>
          </div>
          {forgot && (
            <p className="callout callout--muted" style={{ marginTop: 12 }} role="status">
              {forgot}
            </p>
          )}
        </div>
        <div className="auth-foot">
          <span>{TZ_LABEL}</span>
          <span>Sample data only · nothing is stored</span>
        </div>
      </div>
    </div>
  );
}