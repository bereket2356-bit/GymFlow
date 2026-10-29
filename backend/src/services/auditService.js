import { AuditLog } from "../models/AuditLog.js";
import { logger } from "../utils/logger.js";

function plain(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === "function") return doc.toObject({ versionKey: false });
  return doc;
}

/** Append-only audit trail for every mutation the owner can perform. */
export async function recordAudit({ actor, action, entityType, entityId, before = null, after = null, session }) {
  try {
    await AuditLog.create(
      [
        {
          actor,
          action,
          entityType,
          entityId: String(entityId),
          before: plain(before),
          after: plain(after),
          at: new Date(),
        },
      ],
      { session },
    );
  } catch (err) {
    // An audit failure must be visible, but must never corrupt a completed write.
    logger.error({ err, action, entityType, entityId: String(entityId) }, "Failed to write audit log");
    throw err;
  }
}

export function shallowDiff(before, after) {
  const source = plain(before) || {};
  const target = plain(after) || {};
  const changes = {};
  for (const key of Object.keys(target)) {
    if (["_id", "__v", "createdAt", "updatedAt", "singleton"].includes(key)) continue;
    const a = source[key];
    const b = target[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { before: a ?? null, after: b };
  }
  return changes;
}
