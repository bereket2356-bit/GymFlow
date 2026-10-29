import pino from "pino";
import env from "../config/env.js";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "passwordHash",
  "token",
  "*.password",
  "*.passwordHash",
  "*.token",
  "body.password",
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (env.isTest ? "silent" : "info"),
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: { service: "bgms-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** Keep the shape of a phone number visible while hiding the digits. */
export function maskPhone(phone) {
  if (!phone) return phone;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  const shown = digits.slice(-2);
  return `${digits.slice(0, 3)}${"•".repeat(Math.max(3, digits.length - 5))}${shown}`;
}
