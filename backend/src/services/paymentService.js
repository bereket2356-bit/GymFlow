import mongoose from "mongoose";
import { Payment } from "../models/Payment.js";
import { PaymentAdjustment } from "../models/PaymentAdjustment.js";
import { nextSequence } from "../models/Counter.js";
import { Membership } from "../models/Membership.js";
import { findCustomerOrThrow, findMembershipOrThrow, findPaymentOrThrow } from "./lookupService.js";
import { customerBalances, membershipBalances } from "./balanceService.js";
import { serializePayment, serializeAdjustment } from "./serialize.js";
import { recordAudit } from "./auditService.js";
import { businessRule, notFound } from "../utils/errors.js";
import { parseISODate, todayInTimeZone, toISODate } from "../utils/dates.js";
import { toCents, fromCents } from "../utils/money.js";

export const PAYMENT_SORT_FIELDS = ["receivedOn", "amountCents", "createdAt", "method"];

async function adjustmentsForPayments(paymentIds) {
  if (paymentIds.length === 0) return new Map();
  const adjustments = await PaymentAdjustment.find({ originalPayment: { $in: paymentIds } }).sort({ createdAt: 1 });
  const map = new Map();
  for (const adjustment of adjustments) {
    const key = String(adjustment.originalPayment);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(adjustment);
  }
  return map;
}

export async function recordPayment(payload, { actor, settings }) {
  const customer = await findCustomerOrThrow(payload.customerId ?? payload.customer);
  if (customer.status === "archived") {
    throw businessRule("Archived customers cannot receive payments. Restore the customer first.");
  }

  let membership = null;
  if (payload.membershipId) {
    membership = await findMembershipOrThrow(payload.membershipId);
    if (String(membership.customer) !== String(customer._id)) {
      throw businessRule("This membership belongs to a different customer.");
    }
  }

  const amountCents = toCents(payload.amount);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw businessRule("amount must be greater than zero.");
  }

  let balanceCents;
  if (membership) {
    const map = await membershipBalances([membership._id]);
    balanceCents = map.get(String(membership._id))?.balanceCents ?? membership.agreedPriceCents;
  } else {
    const map = await customerBalances([customer._id]);
    balanceCents = map.get(String(customer._id))?.balanceCents ?? 0;
  }

  if (amountCents > balanceCents) {
    throw businessRule(
      `The payment of ${fromCents(amountCents).toFixed(2)} exceeds the outstanding balance of ` +
        `${Math.max(0, fromCents(balanceCents)).toFixed(2)}. Record an adjustment instead of overpaying.`,
      { code: "OVERPAYMENT", attemptedAmount: fromCents(amountCents), balance: Math.max(0, fromCents(balanceCents)) },
    );
  }

  const today = todayInTimeZone(settings?.timezone);
  const receivedOn = payload.receivedOn ? parseISODate(payload.receivedOn) : parseISODate(today);
  if (!receivedOn) throw businessRule("receivedOn must be a valid calendar date (YYYY-MM-DD).");

  const payment = await Payment.create({
    code: `PAY-${await nextSequence("payment", { start: 9041 })}`,
    customer: customer._id,
    membership: membership ? membership._id : null,
    amountCents,
    method: payload.method,
    receivedOn,
    reference: payload.reference ?? null,
    recordedBy: actor,
  });

  await recordAudit({
    actor,
    action: "payment.create",
    entityType: "Payment",
    entityId: payment._id,
    after: payment,
  });

  const updatedMap = membership
    ? await membershipBalances([membership._id])
    : await customerBalances([customer._id]);
  const updated = membership
    ? updatedMap.get(String(membership._id))?.balanceCents
    : updatedMap.get(String(customer._id))?.balanceCents;

  return {
    payment: serializePayment(payment, { customer }),
    balance: fromCents(updated ?? 0),
    receivedOn: toISODate(receivedOn),
  };
}

export async function listPayments({ customerId, membershipId, from, to, method, page, limit, skip, sort }) {
  const filter = {};
  if (customerId) {
    const customer = await findCustomerOrThrow(customerId);
    filter.customer = customer._id;
  }
  if (membershipId) {
    const membership = await findMembershipOrThrow(membershipId);
    filter.membership = membership._id;
  }
  if (method) filter.method = method;
  if (from || to) {
    filter.receivedOn = {};
    if (from) filter.receivedOn.$gte = parseISODate(from);
    if (to) filter.receivedOn.$lte = parseISODate(to);
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter).sort(sort).skip(skip).limit(limit).populate("customer").populate("membership"),
    Payment.countDocuments(filter),
  ]);
  const adjustments = await adjustmentsForPayments(payments.map((p) => p._id));

  const items = payments.map((payment) => {
    const list = adjustments.get(String(payment._id)) ?? [];
    const adjustedCents = list.reduce((sum, item) => sum + item.amountCents, 0);
    const data = serializePayment(payment, {
      customer: payment.customer,
      membership: payment.membership,
      adjustedCents,
    });
    data.adjustments = list.map(serializeAdjustment);
    return data;
  });

  const netTotalCents = items.reduce((sum, item) => sum + Math.round(item.netAmount * 100), 0);
  return { items, total, netTotal: fromCents(netTotalCents) };
}

/**
 * Payments are immutable. Corrections are appended as adjustments that point
 * at the original payment; the original document is never modified.
 */
export async function addPaymentAdjustment(paymentId, payload, { actor, settings }) {
  const payment = await findPaymentOrThrow(paymentId);
  const amountCents = toCents(payload.amount);
  if (!Number.isInteger(amountCents) || amountCents === 0) {
    throw businessRule("Adjustment amount must be a non-zero number.");
  }

  const existing = await PaymentAdjustment.find({ originalPayment: payment._id });
  const existingSum = existing.reduce((sum, item) => sum + item.amountCents, 0);
  if (payment.amountCents + existingSum + amountCents < 0) {
    throw businessRule("This adjustment would take the recorded payment below zero.", {
      code: "ADJUSTMENT_EXCEEDS_PAYMENT",
      netPayment: fromCents(payment.amountCents + existingSum),
    });
  }

  const adjustment = await PaymentAdjustment.create({
    originalPayment: payment._id,
    amountCents,
    reason: payload.reason,
    recordedBy: actor,
  });
  await recordAudit({
    actor,
    action: "payment.adjustment.create",
    entityType: "PaymentAdjustment",
    entityId: adjustment._id,
    after: adjustment,
  });

  let balance = null;
  if (payment.membership) {
    const map = await membershipBalances([payment.membership]);
    balance = map.get(String(payment.membership))?.balanceCents ?? null;
  }

  const customer = await findCustomerOrThrow(payment.customer);
  return {
    adjustment: serializeAdjustment(adjustment),
    payment: serializePayment(payment, { customer, adjustedCents: existingSum + amountCents }),
    balance: balance === null ? null : fromCents(balance),
    currency: settings?.currency,
  };
}

export async function getPayment(idOrCode) {
  const payment = await findPaymentOrThrow(idOrCode);
  const adjustments = await PaymentAdjustment.find({ originalPayment: payment._id }).sort({ createdAt: 1 });
  return {
    payment: serializePayment(payment),
    adjustments: adjustments.map(serializeAdjustment),
  };
}

export async function membershipPaymentTotals(membershipIds) {
  const rows = await Payment.aggregate([
    { $match: { membership: { $in: membershipIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
    { $group: { _id: "$membership", total: { $sum: "$amountCents" } } },
  ]);
  const map = new Map();
  for (const row of rows) map.set(String(row._id), row.total);
  return map;
}

export { notFound };
