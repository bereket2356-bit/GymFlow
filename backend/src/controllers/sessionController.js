import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, parseSort, buildMeta } from "../utils/pagination.js";
import { getSettings } from "../services/settingsService.js";
import {
  SESSION_SORT_FIELDS,
  cancelSession,
  createSession,
  listSessions,
  updateSession,
} from "../services/sessionService.js";
import { bulkMarkAttendance, getSessionAttendance } from "../services/attendanceService.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const sort = parseSort(req.query.sort, SESSION_SORT_FIELDS, "startsAt");
  const { items, total } = await listSessions({
    from: req.query.from,
    to: req.query.to,
    status: req.query.status,
    sort,
    page,
    limit,
    skip,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

export const create = asyncHandler(async (req, res) => {
  const session = await createSession(req.body, { actor: req.ownerId });
  res.status(201).json({ data: { session } });
});

export const update = asyncHandler(async (req, res) => {
  const session = await updateSession(req.params.id, req.body, { actor: req.ownerId });
  res.json({ data: { session } });
});

export const cancel = asyncHandler(async (req, res) => {
  const session = await cancelSession(req.params.id, { actor: req.ownerId });
  res.json({ data: { session } });
});

export const attendance = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ data: await getSessionAttendance(req.params.id, settings) });
});

export const markAttendance = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await bulkMarkAttendance(req.params.id, req.body.entries, {
    actor: req.ownerId,
    settings,
  });
  res.json({ data });
});
