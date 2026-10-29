import { randomUUID } from "node:crypto";
import { badRequest } from "../utils/errors.js";

/** Attach a request id and echo it back on every response. */
export function requestId(req, res, next) {
  const incoming = req.get("X-Request-Id");
  req.id = incoming && incoming.length <= 100 ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

/**
 * Reject Mongo operator injection: no key may begin with "$" or contain ".".
 * Zod's strict schemas already reject unknown fields; this is a second gate.
 */
export function rejectDangerousKeys(req, _res, next) {
  const scan = (value, path) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) {
        throw badRequest(`Field "${path}${path ? "." : ""}${key}" is not allowed.`);
      }
      scan(child, path ? `${path}.${key}` : key);
    }
  };
  try {
    scan(req.body, "body");
    scan(req.query, "query");
    scan(req.params, "params");
    next();
  } catch (err) {
    next(err);
  }
}

/** Abort requests that take too long instead of holding a socket open. */
export function requestTimeout(ms = 15000) {
  return function timeout(req, res, next) {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          error: { code: "REQUEST_TIMEOUT", message: "The request took too long. Try again." },
        });
      }
    }, ms);
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  };
}
