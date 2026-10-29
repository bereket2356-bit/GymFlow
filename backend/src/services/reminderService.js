import mongoose from "mongoose";
import { Customer } from "../models/Customer.js";
import { Attendance } from "../models/Attendance.js";
import { ReminderReview } from "../models/ReminderReview.js";
import { membershipBalances } from "./balanceService.js";
import { membershipStatus, isSessionBased, paymentStatus } from "./statusService.js";
import { membershipsByCustomer, pickCurrentMembership } from "./membershipService.js";
import { recordAudit } from "./auditService.js";
import { serializeCustomerSummary } from "./serialize.js";
import { notFound } from "../utils/errors.js";
import {
  daysBetweenISO,
  parseISODate,
  toISODate,
  todayInTimeZone,
} from "../utils/dates.js";
import { fromCents } from "../utils/money.js";

export const REMINDER_ORDER = ["expired", "balance", "sessions", "expiry", "inactive"];

const TONES = {
  expired: "danger",
  balance: "danger",
  sessions: "info",
  expiry: "warning",
  inactive: "neutral",
};

function displayMoney(cents) {
  const value = fromCents(cents);
  return Number.isInteger(value) ? `$${value.toLocaleString("en-US")}` : `$${value.toFixed(2)}`;
}

function plural(n, one, many) {
  return n === 1 ? one : many ?? `${one}s`;
}

function daysLabel(days) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

async function lastVisits(customerIds) {
  const map = new Map();
  if (customerIds.length === 0) return map;
  const rows = await Attendance.aggregate([
    {
      $match: {
        customer: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        status: { $in: ["present", "late"] },
      },
    },
    { $group: { _id: "$customer", last: { $max: "$markedAt" } } },
  ]);
  for (const row of rows) map.set(String(row._id), row.last);
  return map;
}

/**
 * Reminders are derived on every request and never stored as messages. The
 * only persisted state is which stable keys the owner has reviewed.
 */
export async function buildReminders(settings) {
  const today = todayInTimeZone(settings.timezone);
  const customers = await Customer.find({ status: "active" }).sort({ name: 1 });
  const ids = customers.map((c) => c._id);
  const membershipsMap = await membershipsByCustomer(ids);
  const visits = await lastVisits(ids);

  const currentMemberships = [];
  for (const customer of customers) {
    const list = membershipsMap.get(String(customer._id)) ?? [];
    const current = pickCurrentMembership(list, today);
    if (current) currentMemberships.push({ customer, membership: current });
  }
  const balances = await membershipBalances(currentMemberships.map((item) => item.membership._id));
  const windows = [...settings.reminderWindows].sort((a, b) => a - b);
  const widest = windows[windows.length - 1] ?? 0;

  const reminders = [];
  const push = ({ type, rule, text, customer, membership }) => {
    reminders.push({
      key: `${type}:${customer.customerId}`,
      type,
      rule,
      text,
      tone: TONES[type] ?? "neutral",
      customer: serializeCustomerSummary(customer),
      membershipId: membership ? String(membership._id) : null,
    });
  };

  for (const { customer, membership } of currentMemberships) {
    const status = membershipStatus(membership, { todayISO: today, reminderWindows: settings.reminderWindows });
    const balance = balances.get(String(membership._id)) ?? { balanceCents: 0, paidCents: 0 };

    if (status === "expired" && membership.expiryDate) {
      const daysAgo = Math.abs(daysBetweenISO(today, toISODate(membership.expiryDate)));
      push({
        type: "expired",
        rule: "Expired",
        text: `Membership expired ${daysAgo} ${plural(daysAgo, "day")} ago`,
        customer,
        membership,
      });
    } else if (membership.expiryDate) {
      const daysLeft = daysBetweenISO(today, toISODate(membership.expiryDate));
      if (daysLeft >= 0 && daysLeft <= widest) {
        const window = windows.find((value) => daysLeft <= value) ?? widest;
        push({
          type: "expiry",
          rule: `${window}-day window`,
          text: `Membership expires ${daysLabel(daysLeft)}`,
          customer,
          membership,
        });
      }
    }

    if (isSessionBased(membership.packageSnapshot) && membership.sessionsRemaining <= 0) {
      push({
        type: "sessions",
        rule: "Zero sessions",
        text: `Session pack exhausted — 0 of ${membership.sessionsTotal} left`,
        customer,
        membership,
      });
    }

    const started = toISODate(membership.startDate) <= today;
    if (balance.balanceCents > 0 && started) {
      push({
        type: "balance",
        rule: "Overdue",
        text: `Balance of ${displayMoney(balance.balanceCents)} outstanding`,
        customer,
        membership,
      });
    }

    const last = visits.get(String(customer._id)) ?? null;
    const reference = last ? toISODate(last) : toISODate(customer.registeredAt);
    const inactiveDays = daysBetweenISO(reference, today);
    if (inactiveDays >= settings.inactivityDays) {
      push({
        type: "inactive",
        rule: `Inactive ${settings.inactivityDays} days`,
        text: last
          ? `No visit in ${inactiveDays} days`
          : `No visit recorded since registering ${inactiveDays} days ago`,
        customer,
        membership,
      });
    }
  }

  reminders.sort((a, b) => {
    const diff = REMINDER_ORDER.indexOf(a.type) - REMINDER_ORDER.indexOf(b.type);
    if (diff !== 0) return diff;
    return a.customer.name.localeCompare(b.customer.name);
  });

  return { today, reminders };
}

export async function listReminders(settings) {
  const { today, reminders } = await buildReminders(settings);
  const keys = reminders.map((reminder) => reminder.key);
  const reviews = await ReminderReview.find({ key: { $in: keys } });
  const reviewMap = new Map(reviews.map((review) => [review.key, review]));

  const items = reminders.map((reminder) => {
    const review = reviewMap.get(reminder.key);
    return {
      ...reminder,
      reviewed: Boolean(review),
      reviewedAt: review ? review.reviewedAt.toISOString() : null,
    };
  });

  return {
    today,
    reminders: items,
    counts: {
      total: items.length,
      open: items.filter((item) => !item.reviewed).length,
      reviewed: items.filter((item) => item.reviewed).length,
    },
  };
}

/** Marking a reminder reviewed writes only to ReminderReview. */
export async function reviewReminder(key, { actor, settings }) {
  const { reminders } = await buildReminders(settings);
  const reminder = reminders.find((item) => item.key === key);
  if (!reminder) throw notFound("That reminder is no longer active.");

  const review = await ReminderReview.findOneAndUpdate(
    { key },
    {
      $set: {
        reviewedAt: new Date(),
        reviewedBy: actor,
        customer: mongoose.isValidObjectId(reminder.customer.id) ? reminder.customer.id : null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await recordAudit({
    actor,
    action: "reminder.review",
    entityType: "ReminderReview",
    entityId: review._id,
    after: { key, reviewedAt: review.reviewedAt },
  });

  return {
    key,
    reviewed: true,
    reviewedAt: review.reviewedAt.toISOString(),
  };
}

export { paymentStatus, parseISODate };
