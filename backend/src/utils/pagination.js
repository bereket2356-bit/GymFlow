import { badRequest } from "./errors.js";

const MAX_LIMIT = 100;

export function parsePagination(query = {}, { defaultLimit = 20 } = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) throw badRequest("page must be an integer of at least 1.");
  if (!Number.isInteger(limit) || limit < 1) throw badRequest("limit must be an integer of at least 1.");
  if (limit > MAX_LIMIT) throw badRequest(`limit cannot exceed ${MAX_LIMIT}.`);
  return { page, limit, skip: (page - 1) * limit, maxLimit: MAX_LIMIT };
}

export function parseSort(raw, allowed, fallback = "-createdAt") {
  const value = raw === undefined || raw === "" ? fallback : String(raw);
  const fields = value.split(",").map((part) => part.trim()).filter(Boolean);
  const sort = {};
  for (const field of fields) {
    const direction = field.startsWith("-") ? -1 : 1;
    const name = field.replace(/^[+-]/, "");
    if (!allowed.includes(name)) {
      throw badRequest(`Cannot sort by "${name}". Allowed fields: ${allowed.join(", ")}.`);
    }
    sort[name] = direction;
  }
  return sort;
}

export function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

export function assertDateRange(from, to) {
  if (from && to && from > to) throw badRequest("The start date must be on or before the end date.");
}
