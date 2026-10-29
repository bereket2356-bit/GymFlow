import mongoose from "mongoose";
import { Customer } from "../models/Customer.js";
import { Membership } from "../models/Membership.js";
import { Payment } from "../models/Payment.js";
import { PaymentAdjustment } from "../models/PaymentAdjustment.js";

const objectId = (value) => new mongoose.Types.ObjectId(String(value));

function normalizeIds(customerIds = []) {
  return customerIds.filter(Boolean).map(objectId);
}

/**
 * Per-customer money totals in a single aggregation over Customer.
 * balance = agreed membership total − payments − signed adjustments.
 * Nothing here is stored: it is recomputed on every read.
 */
export async function customerBalances(customerIds) {
  const ids = normalizeIds(customerIds);
  const result = new Map();
  if (ids.length === 0) return result;

  const rows = await Customer.aggregate([
    { $match: { _id: { $in: ids } } },
    {
      $lookup: {
        from: Membership.collection.name,
        localField: "_id",
        foreignField: "customer",
        as: "memberships",
      },
    },
    {
      $lookup: {
        from: Payment.collection.name,
        localField: "_id",
        foreignField: "customer",
        as: "payments",
      },
    },
    {
      $lookup: {
        from: PaymentAdjustment.collection.name,
        let: { paymentIds: "$payments._id" },
        pipeline: [{ $match: { $expr: { $in: ["$originalPayment", "$$paymentIds"] } } }],
        as: "adjustments",
      },
    },
    {
      $project: {
        agreedCents: { $sum: "$memberships.agreedPriceCents" },
        paidCents: { $sum: "$payments.amountCents" },
        adjustmentCents: { $sum: "$adjustments.amountCents" },
        payments: "$payments",
        memberships: "$memberships",
      },
    },
  ]);

  for (const row of rows) {
    const balanceCents = row.agreedCents - row.paidCents - row.adjustmentCents;
    result.set(String(row._id), {
      agreedCents: row.agreedCents,
      paidCents: row.paidCents,
      adjustmentCents: row.adjustmentCents,
      balanceCents,
    });
  }
  return result;
}

/** Per-membership balances in one aggregation over Membership. */
export async function membershipBalances(membershipIds) {
  const ids = normalizeIds(membershipIds);
  const result = new Map();
  if (ids.length === 0) return result;

  const rows = await Membership.aggregate([
    { $match: { _id: { $in: ids } } },
    {
      $lookup: {
        from: Payment.collection.name,
        localField: "_id",
        foreignField: "membership",
        as: "payments",
      },
    },
    {
      $lookup: {
        from: PaymentAdjustment.collection.name,
        let: { paymentIds: "$payments._id" },
        pipeline: [{ $match: { $expr: { $in: ["$originalPayment", "$$paymentIds"] } } }],
        as: "adjustments",
      },
    },
    {
      $project: {
        agreedPriceCents: 1,
        paidCents: { $sum: "$payments.amountCents" },
        adjustmentCents: { $sum: "$adjustments.amountCents" },
      },
    },
  ]);

  for (const row of rows) {
    result.set(String(row._id), {
      agreedCents: row.agreedPriceCents,
      paidCents: row.paidCents,
      adjustmentCents: row.adjustmentCents,
      balanceCents: row.agreedPriceCents - row.paidCents - row.adjustmentCents,
    });
  }
  return result;
}

/** Outstanding across every non-archived customer. */
export async function outstandingTotal() {
  const customers = await Customer.aggregate([
    { $match: { status: "active" } },
    { $project: { _id: 1 } },
  ]);
  const balances = await customerBalances(customers.map((c) => c._id));
  let total = 0;
  for (const value of balances.values()) {
    if (value.balanceCents > 0) total += value.balanceCents;
  }
  return total;
}

/** Money still owed on a single membership (never negative). */
export async function membershipOutstandingCents(membershipId) {
  const map = await membershipBalances([membershipId]);
  const entry = map.get(String(membershipId));
  return entry ? Math.max(0, entry.balanceCents) : 0;
}
