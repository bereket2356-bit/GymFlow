import rateLimit from "express-rate-limit";
import { rateLimited } from "../utils/errors.js";

function handler(_req, _res, next) {
  next(rateLimited());
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Five failed attempts per IP per 15 minutes. */
export const loginIpLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler,
});

/** Five failed attempts per email per 15 minutes, regardless of IP. */
export const loginEmailLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `email:${String(req.body?.email ?? "").toLowerCase().trim()}`,
  handler,
});
