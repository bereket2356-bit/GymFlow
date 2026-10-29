import mongoose from "mongoose";
import { Customer } from "../models/Customer.js";
import { Membership } from "../models/Membership.js";
import { Payment } from "../models/Payment.js";
import { PaymentAdjustment } from "../models/PaymentAdjustment.js";
import { Attendance } from "../models/Attendance.js";
import { TrainingSession } from "../models/TrainingSession.js";
import { nextSequence } from "../models/Counter.js";
import { findCustomerOrThrow } from "./lookupService.js";
import { customerBalances, membershipBalances } from "./balanceService.js";
import { membershipStatus, paymentStatus } from "./statusService.js";
import {
  enrichMemberships,
  membershipsByCustomer,
  pickCurrentMembership,
} from "./membershipService.js";
import { serializeCustomer, serializeMembership, serializePayment } from "./serialize.js";
import { recordAudit } from "./auditService.js";
import { notFound, businessRule, customerHasRecords } from "../utils/errors.js";
import { withOptionalTransaction } from "../utils/transactions.js";
import {
  addDaysISO,
  parseISODate,
  startOfWeekISO,
  toISODate,
  todayInTimeZone,
} from "../utils/dates.js";
import { fromCents } from "../utils/money.js";

export const CUSTOMER_SORT_FIELDS = ["name", "registeredAt", "customerId", "createdAt", "updatedAt"];

function todayISO(settings) {
  return todayInTimeZone(settings?.timezone);
}

async function lastVisitMap(customerIds) {
  const map = new Map();
  if (customerIds.length === 0) return map;
  const rows = await Attendance.aggregate([
    {
      $match: {
        customer: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        status: { $in: ["present", "late"] },
      },
    },
    { $group: { _id: "$customer", lastVisit: { $max: "$markedAt" } } },
  ]);
  for (const row of rows) map.set(String(row._id), row.lastVisit);
  return map;
}

function overallPaymentStatus(balanceCents, paidCents, memberships, today) {
  if (balanceCents <= 0) return "paid";
  const started = memberships.some((m) => toISODate(m.startDate) <= today);
  if (started) return "overdue";
  if (paidCents > 0) return "partial";
  return "unpaid";
}

export async function listCustomers({ search, status, sort, page, limit, skip, settings }) {
  const filter = {};
  if (status === "active" || status === "archived") filter.status = status;
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: safe, $options: "i" } },
      { customerId: { $regex: safe, $options: "i" } },
      { phone: { $regex: safe, $options: "i" } },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  const today = todayISO(settings);
  const ids = customers.map((c) => c._id);
  const membershipsMap = await membershipsByCustomer(ids);
  const balances = await customerBalances(ids);
  const visits = await lastVisitMap(ids);

  const items = await Promise.all(
    customers.map(async (customer) => {
      const memberships = membershipsMap.get(String(customer._id)) ?? [];
      const current = pickCurrentMembership(memberships, today);
      const balance = balances.get(String(customer._id)) ?? {
        agreedCents: 0,
        paidCents: 0,
        adjustmentCents: 0,
        balanceCents: 0,
      };
      let currentMembership = null;
      const enrichedMemberships = await enrichMemberships(memberships, settings);
      if (current) {
        const foundCurrent = enrichedMemberships.find((m) => String(m.id) === String(current._id));
        currentMembership = foundCurrent || (await enrichMemberships([current], settings))[0];
      }
      const lastVisit = visits.get(String(customer._id)) ?? null;
      return {
        id: String(customer._id),
        customerId: customer.customerId,
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? null,
        status: customer.status,
        registeredAt: toISODate(customer.registeredAt),
        archivedAt: customer.archivedAt ? new Date(customer.archivedAt).toISOString() : null,
        memberships: enrichedMemberships,
        currentMembership,
        membershipStatus: currentMembership?.status ?? null,
        balance: fromCents(balance.balanceCents),
        paymentStatus: overallPaymentStatus(balance.balanceCents, balance.paidCents, memberships, today),
        lastVisit: lastVisit ? new Date(lastVisit).toISOString() : null,
      };
    }),
  );

  return { items, total };
}

export async function getCustomer(idOrCode, settings) {
  const customer = await findCustomerOrThrow(idOrCode);
  const today = todayISO(settings);
  const memberships = await Membership.find({ customer: customer._id }).sort({ startDate: 1 });
  const enriched = await enrichMemberships(memberships, settings);
  const balances = await customerBalances([customer._id]);
  const balance = balances.get(String(customer._id)) ?? {
    agreedCents: 0,
    paidCents: 0,
    adjustmentCents: 0,
    balanceCents: 0,
  };
  const current = pickCurrentMembership(memberships, today);
  const currentStatus = current
    ? membershipStatus(current, { todayISO: today, reminderWindows: settings.reminderWindows })
    : null;

  return {
    customer: serializeCustomer(customer),
    memberships: enriched,
    summary: {
      agreedTotal: fromCents(balance.agreedCents),
      paidTotal: fromCents(balance.paidCents),
      adjustmentsTotal: fromCents(balance.adjustmentCents),
      balance: fromCents(balance.balanceCents),
      paymentStatus: overallPaymentStatus(balance.balanceCents, balance.paidCents, memberships, today),
      membershipStatus: currentStatus,
      membershipCount: memberships.length,
    },
  };
}

export async function createCustomer(payload, { actor }) {
  const seq = await nextSequence("customer", { start: 1042 });
  const customer = await Customer.create({
    customerId: `CUS-${seq}`,
    name: payload.name,
    phone: payload.phone,
    email: payload.email ?? null,
    notes: payload.notes ?? "",
    status: "active",
    registeredAt: parseISODate(payload.registeredAt) ?? new Date(),
  });
  await recordAudit({
    actor,
    action: "customer.create",
    entityType: "Customer",
    entityId: customer._id,
    after: customer,
  });
  return serializeCustomer(customer);
}

export async function updateCustomer(idOrCode, payload, { actor }) {
  const customer = await findCustomerOrThrow(idOrCode);
  const before = customer.toObject();
  const fields = ["name", "phone", "email", "notes"];
  for (const field of fields) {
    if (payload[field] !== undefined) customer[field] = payload[field];
  }
  await customer.save();
  await recordAudit({
    actor,
    action: "customer.update",
    entityType: "Customer",
    entityId: customer._id,
    before,
    after: customer.toObject(),
  });
  return serializeCustomer(customer);
}

export async function archiveCustomer(idOrCode, { actor }) {
  const customer = await findCustomerOrThrow(idOrCode);
  if (customer.status === "archived") throw businessRule("This customer is already archived.");
  const before = customer.toObject();
  customer.status = "archived";
  customer.archivedAt = new Date();
  await customer.save();
  await recordAudit({
    actor,
    action: "customer.archive",
    entityType: "Customer",
    entityId: customer._id,
    before,
    after: customer.toObject(),
  });
  return serializeCustomer(customer);
}

export async function restoreCustomer(idOrCode, { actor }) {
  const customer = await findCustomerOrThrow(idOrCode);
  if (customer.status === "active") throw businessRule("This customer is already active.");
  const before = customer.toObject();
  customer.status = "active";
  customer.archivedAt = null;
  await customer.save();
  await recordAudit({
    actor,
    action: "customer.restore",
    entityType: "Customer",
    entityId: customer._id,
    before,
    after: customer.toObject(),
  });
  return serializeCustomer(customer);
}

/**
 * Chronological ledger: membership charges increase what is owed, payments
 * reduce it, and signed adjustments move it in the direction they are recorded.
 */
export async function deleteCustomer(idOrCode, { actor }) {
  const customer = await findCustomerOrThrow(idOrCode);

  return withOptionalTransaction(async (session) => {
    const membershipCount = await Membership.countDocuments({ customer: customer._id }).session(session);
    if (membershipCount > 0) {
      throw customerHasRecords();
    }

    const paymentCount = await Payment.countDocuments({ customer: customer._id }).session(session);
    if (paymentCount > 0) {
      throw customerHasRecords();
    }

    const attendanceCount = await Attendance.countDocuments({ customer: customer._id }).session(session);
    if (attendanceCount > 0) {
      throw customerHasRecords();
    }

    const paymentIds = await Payment.find({ customer: customer._id }).session(session).distinct("_id");
    if (paymentIds.length > 0) {
      const adjustmentCount = await PaymentAdjustment.countDocuments({
        originalPayment: { $in: paymentIds },
      }).session(session);
      if (adjustmentCount > 0) {
        throw customerHasRecords();
      }
    }

    await Customer.deleteOne({ _id: customer._id }, { session });

    await recordAudit({
      actor,
      action: "customer.delete",
      entityType: "Customer",
      entityId: customer._id,
      before: {
        customerId: customer.customerId,
        name: customer.name,
      },
      after: null,
      session,
    });

    return { id: String(customer._id), customerId: customer.customerId, name: customer.name };
  });
}

export async function getCustomerLedger(idOrCode, settings) {
  const customer = await findCustomerOrThrow(idOrCode);
  const [memberships, payments] = await Promise.all([
    Membership.find({ customer: customer._id }).sort({ startDate: 1 }),
    Payment.find({ customer: customer._id }).sort({ receivedOn: 1 }),
  ]);
  const paymentIds = payments.map((p) => p._id);
  const adjustments = await PaymentAdjustment.find({ originalPayment: { $in: paymentIds } }).sort({ createdAt: 1 });
  const paymentById = new Map(payments.map((p) => [String(p._id), p]));
  const customerBalancesMap = await customerBalances([customer._id]);
  const totals = customerBalancesMap.get(String(customer._id)) ?? {
    agreedCents: 0,
    paidCents: 0,
    adjustmentCents: 0,
    balanceCents: 0,
  };
  const membershipBalanceMap = await membershipBalances(memberships.map((m) => m._id));

  const entries = [];
  for (const membership of memberships) {
    const mb = membershipBalanceMap.get(String(membership._id));
    entries.push({
      type: "membership",
      id: String(membership._id),
      code: membership.code,
      date: toISODate(membership.startDate),
      description: `${membership.packageSnapshot.name} membership`,
      deltaCents: membership.agreedPriceCents,
      memo: mb ? { paid: fromCents(mb.paidCents), balance: fromCents(Math.max(0, mb.balanceCents)) } : null,
    });
  }
  for (const payment of payments) {
    entries.push({
      type: "payment",
      id: String(payment._id),
      code: payment.code,
      date: toISODate(payment.receivedOn),
      description: `Payment — ${payment.method.replace(/_/g, " ")}`,
      deltaCents: -payment.amountCents,
      memo: { reference: payment.reference ?? null },
    });
  }
  for (const adjustment of adjustments) {
    const payment = paymentById.get(String(adjustment.originalPayment));
    entries.push({
      type: "adjustment",
      id: String(adjustment._id),
      code: payment?.code ?? null,
      date: toISODate(adjustment.createdAt),
      description: `Adjustment — ${adjustment.reason}`,
      deltaCents: -adjustment.amountCents,
      memo: { originalPayment: payment?.code ?? null },
    });
  }

  entries.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  let running = 0;
  const withRunning = entries.map((entry) => {
    running += entry.deltaCents;
    return {
      type: entry.type,
      id: entry.id,
      code: entry.code,
      date: entry.date,
      description: entry.description,
      amount: fromCents(Math.abs(entry.deltaCents)),
      direction: entry.deltaCents >= 0 ? "charge" : "credit",
      balanceAfter: fromCents(running),
      memo: entry.memo,
    };
  });

  return {
    customer: serializeCustomer(customer),
    entries: withRunning,
    totals: {
      agreed: fromCents(totals.agreedCents),
      paid: fromCents(totals.paidCents),
      adjustments: fromCents(totals.adjustmentCents),
      balance: fromCents(totals.balanceCents),
    },
  };
}

export async function getCustomerAttendance(idOrCode, { days = 30, settings } = {}) {
  const customer = await findCustomerOrThrow(idOrCode);
  const today = todayISO(settings);
  const from = `${addDaysISO(today, -(days - 1))}T00:00:00.000Z`;
  const records = await Attendance.find({ customer: customer._id, markedAt: { $gte: new Date(from) } })
    .sort({ markedAt: -1 })
    .populate("session");

  const allTime = await Attendance.aggregate([
    { $match: { customer: customer._id, status: { $in: ["present", "late"] } } },
    { $group: { _id: null, count: { $sum: 1 }, last: { $max: "$markedAt" } } },
  ]);

  return {
    customer: { id: String(customer._id), customerId: customer.customerId, name: customer.name },
    days,
    from: addDaysISO(today, -(days - 1)),
    to: today,
    counts: {
      present: records.filter((r) => r.status === "present").length,
      late: records.filter((r) => r.status === "late").length,
      absent: records.filter((r) => r.status === "absent").length,
      excused: records.filter((r) => r.status === "excused").length,
    },
    totalVisits: allTime[0]?.count ?? 0,
    lastVisit: allTime[0]?.last ? new Date(allTime[0].last).toISOString() : null,
    records: records.map((record) => ({
      id: String(record._id),
      date: toISODate(record.markedAt),
      status: record.status,
      session: record.session
        ? {
            id: String(record.session._id),
            code: record.session.code,
            title: record.session.title,
            startsAt: new Date(record.session.startsAt).toISOString(),
          }
        : null,
    })),
  };
}

/** Customers without any recorded visit, used by reports. */
export async function neverVisitedCount(customerIds) {
  if (customerIds.length === 0) return 0;
  const visited = await Attendance.distinct("customer", {
    customer: { $in: customerIds },
    status: { $in: ["present", "late"] },
  });
  return customerIds.length - visited.length;
}

export const ledgerWeekStart = startOfWeekISO;
