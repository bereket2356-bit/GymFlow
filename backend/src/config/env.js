import dotenv from "dotenv";

dotenv.config();

const REQUIRED = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CORS_ORIGIN",
  "GYM_NAME",
  "CURRENCY",
  "TIMEZONE",
  "REMINDER_WINDOWS",
  "INACTIVITY_DAYS",
];

const missing = REQUIRED.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. ` +
      "Copy .env.example to .env and fill it in.",
  );
}

function parsePositiveInt(name, raw, fallback) {
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer (received "${raw}").`);
  }
  return value;
}

function parseWindows(raw) {
  const windows = String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const value = Number(part);
      if (!Number.isInteger(value) || value < 1 || value > 365) {
        throw new Error("REMINDER_WINDOWS must be a comma-separated list of day counts between 1 and 365.");
      }
      return value;
    });
  if (windows.length === 0) throw new Error("REMINDER_WINDOWS must contain at least one day count.");
  return [...new Set(windows)].sort((a, b) => b - a);
}

const nodeEnv = process.env.NODE_ENV || "development";
const timeZone = process.env.TIMEZONE;
try {
  new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
} catch {
  throw new Error(`TIMEZONE "${timeZone}" is not a valid IANA timezone.`);
}

const reminderWindows = parseWindows(process.env.REMINDER_WINDOWS);

function parseDurationMs(raw, fallbackMs) {
  const match = /^(\d+)\s*([smhd])$/.exec(String(raw || "").trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "12h";

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: parsePositiveInt("PORT", process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn,
  sessionMaxAgeMs: parseDurationMs(jwtExpiresIn, 12 * 60 * 60 * 1000),
  corsOrigin: process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
  gymName: process.env.GYM_NAME,
  currency: process.env.CURRENCY,
  timezone: timeZone,
  reminderWindows,
  inactivityDays: parsePositiveInt("INACTIVITY_DAYS", process.env.INACTIVITY_DAYS, 14),
  dateCountingRule: process.env.DATE_COUNTING_RULE === "start_day_is_day_one"
    ? "start_day_is_day_one"
    : "start_day_is_day_zero",
  cookieName: "bgms_token",
  cookieSecure: process.env.COOKIE_SECURE === "true" || nodeEnv === "production",
  seedOwnerEmail: process.env.SEED_OWNER_EMAIL,
  seedOwnerPassword: process.env.SEED_OWNER_PASSWORD,
});

export default env;
