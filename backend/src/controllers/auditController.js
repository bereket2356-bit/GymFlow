import { AuditLog } from "../models/AuditLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, parseSort, buildMeta } from "../utils/pagination.js";
import { parseISODate, addDaysISO, todayInTimeZone } from "../utils/dates.js";
import { getSettings } from "../services/settingsService.js";

export const AUDIT_SORT_FIELDS = ["at", "action", "entityType", "createdAt"];

export const list = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, AUDIT_SORT_FIELDS, "-at");

  const filter = {};
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.entityId) filter.entityId = req.query.entityId;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.from || req.query.to) {
    filter.at = {};
    if (req.query.from) filter.at.$gte = parseISODate(req.query.from);
    if (req.query.to) {
      const today = todayInTimeZone(settings.timezone);
      const end = parseISODate(addDaysISO(req.query.to, 1));
      filter.at.$lt = end > parseISODate(today) ? parseISODate(addDaysISO(today, 1)) : end;
    }
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(limit).populate("actor", "name email"),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    data: items.map((entry) => ({
      id: String(entry._id),
      actor: entry.actor
        ? { id: String(entry.actor._id), name: entry.actor.name, email: entry.actor.email }
        : null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      at: entry.at.toISOString(),
    })),
    meta: buildMeta({ page, limit, total }),
  });
});
