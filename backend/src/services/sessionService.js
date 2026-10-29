import { TrainingSession } from "../models/TrainingSession.js";
import { Attendance } from "../models/Attendance.js";
import { nextSequence } from "../models/Counter.js";
import { findSessionOrThrow } from "./lookupService.js";
import { serializeSession } from "./serialize.js";
import { recordAudit } from "./auditService.js";
import { businessRule } from "../utils/errors.js";
import { parseISODate, addDaysISO } from "../utils/dates.js";

export const SESSION_SORT_FIELDS = ["startsAt", "title", "createdAt", "status"];

export async function listSessions({ from, to, status, sort, page, limit, skip }) {
  const filter = {};
  if (status) filter.status = status;
  if (from || to) {
    filter.startsAt = {};
    if (from) filter.startsAt.$gte = parseISODate(from);
    if (to) filter.startsAt.$lt = parseISODate(addDaysISO(to, 1));
  }
  const [sessions, total] = await Promise.all([
    TrainingSession.find(filter).sort(sort).skip(skip).limit(limit),
    TrainingSession.countDocuments(filter),
  ]);
  const ids = sessions.map((session) => session._id);
  const counts = await Attendance.aggregate([
    { $match: { session: { $in: ids } } },
    { $group: { _id: "$session", booked: { $sum: 1 } } },
  ]);
  const bookedMap = new Map(counts.map((row) => [String(row._id), row.booked]));
  return {
    items: sessions.map((session) =>
      serializeSession(session, { bookedCount: bookedMap.get(String(session._id)) ?? 0 }),
    ),
    total,
  };
}

function parseStartsAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw businessRule("startsAt must be a valid ISO 8601 timestamp.");
  return date;
}

export async function createSession(payload, { actor }) {
  const session = await TrainingSession.create({
    code: `S-${await nextSequence("session", { start: 1 })}`,
    title: payload.title,
    startsAt: parseStartsAt(payload.startsAt),
    durationMinutes: payload.durationMinutes,
    capacity: payload.capacity,
    status: payload.status ?? "scheduled",
    instructor: payload.instructor ?? null,
  });
  await recordAudit({
    actor,
    action: "session.create",
    entityType: "TrainingSession",
    entityId: session._id,
    after: session,
  });
  return serializeSession(session, { bookedCount: 0 });
}

export async function updateSession(idOrCode, payload, { actor }) {
  const session = await findSessionOrThrow(idOrCode);
  const before = session.toObject();
  if (payload.title !== undefined) session.title = payload.title;
  if (payload.startsAt !== undefined) session.startsAt = parseStartsAt(payload.startsAt);
  if (payload.durationMinutes !== undefined) session.durationMinutes = payload.durationMinutes;
  if (payload.capacity !== undefined) session.capacity = payload.capacity;
  if (payload.status !== undefined) session.status = payload.status;
  if (payload.instructor !== undefined) session.instructor = payload.instructor;
  await session.save();
  await recordAudit({
    actor,
    action: "session.update",
    entityType: "TrainingSession",
    entityId: session._id,
    before,
    after: session.toObject(),
  });
  return serializeSession(session);
}

export async function cancelSession(idOrCode, { actor }) {
  const session = await findSessionOrThrow(idOrCode);
  if (session.status === "cancelled") throw businessRule("This session is already cancelled.");
  const before = session.toObject();
  session.status = "cancelled";
  await session.save();
  await recordAudit({
    actor,
    action: "session.cancel",
    entityType: "TrainingSession",
    entityId: session._id,
    before,
    after: session.toObject(),
  });
  return serializeSession(session);
}
