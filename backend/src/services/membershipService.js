import mongoose from "mongoose";
import { Membership } from "../models/Membership.js";
import { Package } from "../models/Package.js";
import { Payment } from "../models/Payment.js";
import { nextSequence } from "../models/Counter.js";
import { findCustomerOrThrow, findMembershipOrThrow } from "./lookupService.js";
import { membershipBalances } from "./balanceService.js";
import { membershipStatus, paymentStatus, isTimeLimited, isSessionBased } from "./statusService.js";
import { serializeMembership, serializePayment } from "./serialize.js";
import { recordAudit } from "./auditService.js";
import { conflict, businessRule, notFound } from "../utils/errors.js";
import { computeExpiryISO, todayInTimeZone, parseISODate, addDaysISO, toISODate } from "../utils/dates.js";
import { toCents } from "../utils/money.js";

function todayISO(settings) {
  return todayInTimeZone(settings?.timezone);
}

function stateFromStatus(status) {
  if (status === "expiring_soon") return "active";
  if (status === "cancelled") return "cancelled";
  return status;
}

/** Latest started membership, or the next scheduled one. */
export function pickCurrentMembership(memberships, today) {
  if (!memberships || memberships.length === 0) return null;
  const sorted = [...memberships].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const started = sorted.filter((m) => toISODate(m.startDate) <= today);
  return started.length > 0 ? started[started.length - 1] : sorted[0];
}

export async function membershipsByCustomer(customerIds) {
  const ids = customerIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const memberships = await Membership.find({ customer: { $in: ids } }).sort({ startDate: 1 });
  const map = new Map();
  for (const membership of memberships) {
    const key = String(membership.customer);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(membership);
  }
  return map;
}

/** Enrich memberships with computed status, balance and payment status. */
export async function enrichMemberships(memberships, settings) {
  const today = todayISO(settings);
  const balances = await membershipBalances(memberships.map((m) => m._id));
  return memberships.map((membership) => {
    const balance = balances.get(String(membership._id)) ?? {
      agreedCents: membership.agreedPriceCents,
      paidCents: 0,
      adjustmentCents: 0,
      balanceCents: membership.agreedPriceCents,
    };
    const status = membershipStatus(membership, {
      todayISO: today,
      reminderWindows: settings.reminderWindows,
    });
    return serializeMembership(membership, {
      status,
      balance: balance.balanceCents,
      paymentStatus: paymentStatus(
        { balanceCents: balance.balanceCents, paidCents: balance.paidCents, startDate: membership.startDate },
        today,
      ),
    });
  });
}

async function overlappingTimeMemberships(customerId, startISO, expiryISO) {
  if (!expiryISO) return [];
  const memberships = await Membership.find({
    customer: customerId,
    state: { $nin: ["cancelled", "renewed"] },
  });
  return memberships.filter((m) => {
    const type = m.packageSnapshot?.type;
    if (!isTimeLimited({ type })) return false;
    if (!m.expiryDate) return false;
    const existingStart = toISODate(m.startDate);
    const existingEnd = toISODate(m.expiryDate);
    return existingStart <= expiryISO && startISO <= existingEnd;
  });
}

async function buildFromPackage(pkg, payload, settings) {
  const today = todayISO(settings);
  const startDate = parseISODate(payload.startDate ?? today);
  if (!startDate) throw businessRule("startDate must be a valid calendar date (YYYY-MM-DD).");
  const startISO = toISODate(startDate);
  const snapshot = {
    name: pkg.name,
    type: pkg.type,
    validityValue: pkg.validityValue,
    validityUnit: pkg.validityUnit,
    sessionAllowance: pkg.sessionAllowance,
    priceCents: pkg.priceCents,
  };
  const expiryDate =
    isTimeLimited(snapshot)
      ? parseISODate(
          computeExpiryISO(startISO, pkg.validityValue, pkg.validityUnit, settings.dateCountingRule),
        )
      : null;
  const sessionsTotal = isSessionBased(snapshot) ? pkg.sessionAllowance : 0;
  const agreedPriceCents =
    payload.agreedPrice !== undefined && payload.agreedPrice !== null
      ? toCents(payload.agreedPrice)
      : pkg.priceCents;
  if (!Number.isInteger(agreedPriceCents) || agreedPriceCents < 0) {
    throw businessRule("agreedPrice must be a non-negative amount.");
  }
  return {
    startDate,
    expiryDate,
    snapshot,
    sessionsTotal,
    agreedPriceCents,
  };
}

async function guardOverlap(customerId, startISO, expiryISO, confirm, settings) {
  const conflicts = await overlappingTimeMemberships(customerId, startISO, expiryISO);
  if (conflicts.length === 0 || confirm) return conflicts;
  const details = conflicts.map((m) => ({
    id: String(m._id),
    code: m.code,
    startDate: toISODate(m.startDate),
    expiryDate: toISODate(m.expiryDate),
  }));
  throw conflict(
    "This customer already has a time-based membership covering these dates. " +
      "Send confirm: true to create an overlapping membership anyway.",
    { confirmRequired: true, conflictingMemberships: details },
  );
}

export async function createMembership(customerIdOrCode, payload, { actor, settings }) {
  const customer = await findCustomerOrThrow(customerIdOrCode);
  if (customer.status === "archived") {
    throw businessRule("Archived customers cannot receive a new membership. Restore the customer first.");
  }
  if (!mongoose.isValidObjectId(payload.packageId)) throw businessRule("packageId must be a valid package id.");
  const pkg = await Package.findById(payload.packageId);
  if (!pkg) throw notFound("Package not found.");
  if (pkg.status !== "active") {
    throw businessRule("This package is inactive and cannot be assigned to a new membership.");
  }

  const built = await buildFromPackage(pkg, payload, settings);
  const startISO = toISODate(built.startDate);
  const expiryISO = toISODate(built.expiryDate);
  await guardOverlap(customer._id, startISO, expiryISO, payload.confirm === true, settings);

  const code = `MEM-${await nextSequence("membership", { start: 3298 })}`;
  const draft = new Membership({
    code,
    customer: customer._id,
    package: pkg._id,
    packageSnapshot: built.snapshot,
    startDate: built.startDate,
    expiryDate: built.expiryDate,
    sessionsTotal: built.sessionsTotal,
    sessionsUsed: 0,
    sessionsRemaining: built.sessionsTotal,
    agreedPriceCents: built.agreedPriceCents,
    state: "active",
  });
  const status = membershipStatus(draft, {
    todayISO: todayISO(settings),
    reminderWindows: settings.reminderWindows,
  });
  draft.state = stateFromStatus(status);
  await draft.save();

  await recordAudit({
    actor,
    action: "membership.create",
    entityType: "Membership",
    entityId: draft._id,
    after: draft,
  });

  const [serialized] = await enrichMemberships([draft], settings);
  return {
    membership: { ...serialized, customer: { id: String(customer._id), customerId: customer.customerId, name: customer.name } },
  };
}

export async function renewMembership(idOrCode, payload, { actor, settings }) {
  const previous = await findMembershipOrThrow(idOrCode);
  if (previous.state === "cancelled") {
    throw businessRule("A cancelled membership cannot be renewed. Create a new membership instead.");
  }

  let pkg;
  if (payload.packageId) {
    if (!mongoose.isValidObjectId(payload.packageId)) throw businessRule("packageId must be a valid package id.");
    pkg = await Package.findById(payload.packageId);
    if (!pkg) throw notFound("Package not found.");
  } else {
    pkg = await Package.findById(previous.package);
    if (!pkg) throw businessRule("The original package no longer exists. Choose a package to renew into.");
  }
  if (pkg.status !== "active") {
    throw businessRule("This package is inactive and cannot be used for a renewal.");
  }

  const today = todayISO(settings);
  let defaultStart = today;
  if (previous.expiryDate) {
    const previousExpiry = toISODate(previous.expiryDate);
    const nextStart = addDaysISO(previousExpiry, 1);
    defaultStart = nextStart > today ? nextStart : today;
  }

  const built = await buildFromPackage(pkg, { ...payload, startDate: payload.startDate ?? defaultStart }, settings);
  await guardOverlap(
    previous.customer,
    toISODate(built.startDate),
    toISODate(built.expiryDate),
    payload.confirm === true,
    settings,
  );

  const previousStatus = membershipStatus(previous, {
    todayISO: today,
    reminderWindows: settings.reminderWindows,
  });
  const beforePrevious = previous.toObject();
  const wasTimeLimited = Boolean(previous.expiryDate);
  previous.state = wasTimeLimited && previousStatus === "expired" ? "expired" : "renewed";
  await previous.save();

  const code = `MEM-${await nextSequence("membership", { start: 3298 })}`;
  const draft = new Membership({
    code,
    customer: previous.customer,
    package: pkg._id,
    packageSnapshot: built.snapshot,
    startDate: built.startDate,
    expiryDate: built.expiryDate,
    sessionsTotal: built.sessionsTotal,
    sessionsUsed: 0,
    sessionsRemaining: built.sessionsTotal,
    agreedPriceCents: built.agreedPriceCents,
    state: "active",
    renewedFromId: previous._id,
  });
  draft.state = stateFromStatus(
    membershipStatus(draft, { todayISO: today, reminderWindows: settings.reminderWindows }),
  );
  await draft.save();

  await recordAudit({
    actor,
    action: "membership.renew",
    entityType: "Membership",
    entityId: draft._id,
    before: beforePrevious,
    after: draft,
  });

  const [renewed] = await enrichMemberships([draft], settings);
  return {
    membership: renewed,
    previous: serializeMembership(previous, {
      status: membershipStatus(previous, { todayISO: today, reminderWindows: settings.reminderWindows }),
    }),
  };
}

export async function getMembership(idOrCode, settings) {
  const membership = await findMembershipOrThrow(idOrCode);
  const [enriched] = await enrichMemberships([membership], settings);
  const payments = await Payment.find({ membership: membership._id }).sort({ receivedOn: 1 });
  return {
    membership: enriched,
    payments: payments.map((payment) => serializePayment(payment)),
  };
}

export async function cancelMembership(idOrCode, { reason, actor, settings }) {
  const membership = await findMembershipOrThrow(idOrCode);
  if (membership.state === "cancelled") throw businessRule("This membership is already cancelled.");
  const before = membership.toObject();
  membership.state = "cancelled";
  membership.cancelledAt = new Date();
  await membership.save();
  await recordAudit({
    actor,
    action: "membership.cancel",
    entityType: "Membership",
    entityId: membership._id,
    before,
    after: membership,
  });
  const [enriched] = await enrichMemberships([membership], settings);
  return { membership: enriched, reason: reason ?? null };
}
