/** Membership plans the sample customers already hold. */
export const PLANS = {
  fightcamp: { name: "Fight Camp · 3×/week", type: "time", price: 180, days: 30, pkg: "PKG-MONTHLY" },
  unlimited: { name: "Unlimited Monthly", type: "time", price: 220, days: 30, pkg: "PKG-QUARTER" },
  youth: { name: "Youth Fundamentals", type: "time", price: 120, days: 30, pkg: "PKG-MONTHLY" },
  twelve: { name: "12-Session Pack", type: "session", price: 150, sessions: 12, days: 60, pkg: "PKG-TEN" },
  eight: { name: "8-Session Pack", type: "session", price: 110, sessions: 8, days: 60, pkg: "PKG-FIVE" },
};

export const PLAN_KEYS = ["fightcamp", "unlimited", "youth", "twelve", "eight"];

/** The Packages page catalogue. */
export const SEED_PACKAGES = [
  {
    id: "PKG-MONTHLY",
    name: "Monthly Training",
    description: "Open gym and coached sessions, billed one month at a time.",
    type: "time",
    validity: { n: 1, unit: "months" },
    sessions: null,
    price: 120,
    active: true,
  },
  {
    id: "PKG-TEN",
    name: "10-Session Pack",
    description: "Ten coached sessions, used at the member’s own pace.",
    type: "session",
    validity: null,
    sessions: 10,
    price: 90,
    active: true,
  },
  {
    id: "PKG-QUARTER",
    name: "3-Month Plan",
    description: "The monthly programme paid three months at a time.",
    type: "time",
    validity: { n: 3, unit: "months" },
    sessions: null,
    price: 300,
    active: true,
  },
  {
    id: "PKG-FIVE",
    name: "5-Session Drop-in",
    description: "A short pack for visitors and returning members.",
    type: "session",
    validity: null,
    sessions: 5,
    price: 50,
    active: true,
  },
  {
    id: "PKG-TRIAL",
    name: "Trial Week",
    description: "Seven days for a first-time visitor. Retired from new assignments.",
    type: "time",
    validity: { n: 7, unit: "days" },
    sessions: null,
    price: 25,
    active: false,
  },
];

export function packageTypeLabel(type) {
  return type === "time" ? "Time-based" : type === "session" ? "Session-based" : type === "both" ? "Both" : "Not set";
}

export function validityLabel(n, unit) {
  const v = Number(n);
  return (isFinite(v) ? v : 0) + " " + (v === 1 ? unit.replace(/s$/, "") : unit);
}

export function packageValidityText(p) {
  if (!p || !p.validity || (p.type !== "time" && p.type !== "both")) return "—";
  return validityLabel(p.validity.n, p.validity.unit);
}

export function packageSessionsText(p) {
  if (!p || p.sessions == null || (p.type !== "session" && p.type !== "both")) return "—";
  return p.sessions + (p.sessions === 1 ? " session" : " sessions");
}

/** Whole days a package runs for (months = 30 days, years = 365 days). */
export function packageDays(p) {
  if (!p || !p.validity) return 0;
  const mult = p.validity.unit === "weeks" ? 7 : p.validity.unit === "months" ? 30 : p.validity.unit === "years" ? 365 : 1;
  return Math.max(0, Math.round(Number(p.validity.n) * mult));
}