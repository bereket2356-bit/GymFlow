import { Attendance } from "../models/Attendance.js";
import { Membership } from "../models/Membership.js";
import { TrainingSession } from "../models/TrainingSession.js";
import { findCustomerOrThrow, findSessionOrThrow } from "./lookupService.js";
import { recordAudit } from "./auditService.js";
import { withOptionalTransaction } from "../utils/transactions.js";
import { businessRule, notFound } from "../utils/errors.js";
import { serializeAttendance, serializeSession } from "./serialize.js";
import { toISODate, todayInTimeZone } from "../utils/dates.js";

const DEDUCTING_STATUSES = new Set(["present", "late"]);

async function findDeductibleMembership(customerId, todayISO) {
  const memberships = await Membership.find({
    customer: customerId,
    state: { $in: ["active", "scheduled"] },
  }).sort({ startDate: -1 });
  return (
    memberships.find((m) => {
      const type = m.packageSnapshot?.type;
      if (type !== "session" && type !== "both") return false;
      if (m.sessionsTotal <= 0) return false;
      return toISODate(m.startDate) <= todayISO;
    }) ?? null
  );
}

async function deductOnce(membershipId) {
  const updated = await Membership.findOneAndUpdate(
    { _id: membershipId, sessionsRemaining: { $gt: 0 } },
    { $inc: { sessionsRemaining: -1, sessionsUsed: 1 } },
    { new: true },
  );
  if (!updated) return false;
  if (updated.sessionsRemaining <= 0 && updated.state !== "exhausted") {
    updated.state = "exhausted";
    await updated.save();
  }
  return true;
}

async function restoreOnce(membershipId) {
  const updated = await Membership.findOneAndUpdate(
    { _id: membershipId, sessionsUsed: { $gt: 0 } },
    { $inc: { sessionsRemaining: 1, sessionsUsed: -1 } },
    { new: true },
  );
  if (!updated) return false;
  if (updated.sessionsRemaining > 0 && updated.state === "exhausted") {
    updated.state = "active";
    await updated.save();
  }
  return true;
}

export async function getSessionAttendance(sessionIdOrCode, settings) {
  const session = await findSessionOrThrow(sessionIdOrCode);
  const records = await Attendance.find({ session: session._id }).populate("customer").sort({ markedAt: 1 });
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const record of records) counts[record.status] += 1;

  return {
    session: serializeSession(session, { bookedCount: records.length }),
    attendance: records.map((record) => serializeAttendance(record, { customer: record.customer })),
    counts,
    hasRecords: records.length > 0,
  };
}

/**
 * Upsert one attendance record per (customer, session) pair.
 *
 * Deduction happens at most once per record: a move into present/late deducts
 * one session, and a move away from present/late restores it. The `deducted`
 * flag on the record is the guard, and the whole batch runs in a transaction
 * when MongoDB supports one.
 */
export async function bulkMarkAttendance(sessionIdOrCode, entries, { actor, settings }) {
  const session = await findSessionOrThrow(sessionIdOrCode);
  if (session.status === "cancelled") {
    throw businessRule("Attendance cannot be marked on a cancelled session.");
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw businessRule("Provide at least one attendance entry.");
  }

  const todayISO = todayInTimeZone(settings?.timezone);
  const result = await withOptionalTransaction(async (txnSession) => {
    let deducted = 0;
    let restored = 0;
    const records = [];

    for (const entry of entries) {
      const customer = await findCustomerOrThrow(entry.customerId ?? entry.customer);
      const existing = await Attendance.findOne({ session: session._id, customer: customer._id }).session(
        txnSession,
      );

      let membershipId = existing?.membership ? String(existing.membership) : null;
      if (!membershipId) {
        const candidate = await findDeductibleMembership(customer._id, todayISO);
        membershipId = candidate ? String(candidate._id) : null;
      }

      const wantsDeduction = DEDUCTING_STATUSES.has(entry.status);
      let deductedFlag = existing?.deducted ?? false;

      if (existing) {
        const wasDeducting = DEDUCTING_STATUSES.has(existing.status) && existing.deducted;
        if (wasDeducting && !wantsDeduction && existing.membership) {
          const ok = await restoreOnce(existing.membership);
          if (ok) restored += 1;
          deductedFlag = false;
        } else if (!wasDeducting && wantsDeduction && membershipId) {
          const ok = await deductOnce(membershipId);
          if (ok) deducted += 1;
          deductedFlag = ok;
        } else if (wasDeducting) {
          deductedFlag = true;
        }

        existing.status = entry.status;
        existing.markedBy = actor;
        existing.markedAt = new Date();
        existing.deducted = deductedFlag;
        if (membershipId) existing.membership = membershipId;
        await existing.save({ session: txnSession });
        records.push(existing);
      } else {
        let created = new Attendance({
          customer: customer._id,
          session: session._id,
          membership: membershipId,
          status: entry.status,
          markedBy: actor,
          markedAt: new Date(),
          deducted: false,
        });
        if (wantsDeduction && membershipId) {
          const ok = await deductOnce(membershipId);
          if (ok) deducted += 1;
          created.deducted = ok;
        }
        await created.save({ session: txnSession });
        records.push(created);
      }
    }

    return { records, deducted, restored };
  });

  await recordAudit({
    actor,
    action: "attendance.bulkMark",
    entityType: "TrainingSession",
    entityId: session._id,
    after: { entries: entries.length, deducted: result.deducted, restored: result.restored },
  });

  const populated = await Attendance.find({ _id: { $in: result.records.map((r) => r._id) } })
    .populate("customer")
    .sort({ markedAt: 1 });

  return {
    session: serializeSession(session),
    attendance: populated.map((record) => serializeAttendance(record, { customer: record.customer })),
    deducted: result.deducted,
    restored: result.restored,
    updated: populated.length,
  };
}

export { notFound };
