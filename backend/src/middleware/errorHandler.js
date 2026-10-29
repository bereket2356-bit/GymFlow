import mongoose from "mongoose";
import { ZodError } from "zod";
import env from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function envelope(code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return { error };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const requestId = req.id;

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return res.status(400).json(envelope("VALIDATION_ERROR", details[0]?.message ?? "Invalid request.", details));
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err, requestId }, "Application error");
    return res.status(err.statusCode).json(envelope(err.code, err.message, err.details));
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json(envelope("VALIDATION_ERROR", "Request body is not valid JSON."));
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json(envelope("PAYLOAD_TOO_LARGE", "Request body exceeds 100 KB."));
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    return res.status(400).json(envelope("VALIDATION_ERROR", "One or more fields are invalid.", details));
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json(
      envelope("VALIDATION_ERROR", `"${err.value}" is not a valid value for ${err.path}.`),
    );
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0] ?? "field";
    return res.status(409).json(
      envelope("CONFLICT", `A record with that ${field} already exists.`, { field }),
    );
  }

  logger.error({ err, requestId, path: req.originalUrl, method: req.method }, "Unhandled error");
  const message = env.isProduction ? "An unexpected error occurred." : err.message || "An unexpected error occurred.";
  return res.status(500).json(envelope("INTERNAL_ERROR", message));
}

export default errorHandler;
