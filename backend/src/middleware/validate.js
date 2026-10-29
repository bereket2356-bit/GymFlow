import { ZodError } from "zod";
import { badRequest } from "../utils/errors.js";

function formatIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * Validate body, query and params with strict schemas. Unknown keys and
 * keys beginning with "$" are rejected.
 */
export function validate(schemas = {}) {
  return function validateRequest(req, _res, next) {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) {
        if (req.body === undefined || req.body === null) req.body = {};
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = formatIssues(err);
        next(badRequest(details[0]?.message ?? "Invalid request.", details));
        return;
      }
      next(err);
    }
  };
}

export default validate;
