export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
    this.expose = statusCode < 500;
  }
}

export const badRequest = (message, details) => new AppError(400, "VALIDATION_ERROR", message, details);
export const unauthenticated = (message = "Authentication required.") =>
  new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have access to this resource.") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Resource not found.") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message, details) => new AppError(409, "CONFLICT", message, details);
export const businessRule = (message, details) => new AppError(422, "BUSINESS_RULE_VIOLATION", message, details);
export const rateLimited = (message = "Too many requests. Try again later.") =>
  new AppError(429, "RATE_LIMITED", message);
