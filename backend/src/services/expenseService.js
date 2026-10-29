import { Expense } from "../models/Expense.js";
import { ExpenseAdjustment } from "../models/ExpenseAdjustment.js";
import { findExpenseOrThrow } from "./lookupService.js";
import { serializeExpense, serializeExpenseAdjustment } from "./serialize.js";
import { recordAudit } from "./auditService.js";
import { businessRule } from "../utils/errors.js";
import { parseISODate, toISODate, todayInTimeZone } from "../utils/dates.js";
import { toCents, fromCents } from "../utils/money.js";

export const EXPENSE_SORT_FIELDS = ["incurredOn", "amountCents", "createdAt", "category"];

export async function listExpenses({ from, to, category, page, limit, skip, sort }) {
  const filter = {};
  if (category) filter.category = category;
  if (from || to) {
    filter.incurredOn = {};
    if (from) filter.incurredOn.$gte = parseISODate(from);
    if (to) filter.incurredOn.$lte = parseISODate(to);
  }
  const [expenses, total] = await Promise.all([
    Expense.find(filter).sort(sort).skip(skip).limit(limit),
    Expense.countDocuments(filter),
  ]);
  const adjustments = await ExpenseAdjustment.find({ originalExpense: { $in: expenses.map((e) => e._id) } });
  const adjustMap = new Map();
  for (const adjustment of adjustments) {
    const key = String(adjustment.originalExpense);
    adjustMap.set(key, (adjustMap.get(key) ?? 0) + adjustment.amountCents);
  }
  return {
    items: expenses.map((expense) => {
      const data = serializeExpense(expense);
      const net = expense.amountCents + (adjustMap.get(String(expense._id)) ?? 0);
      data.netAmount = fromCents(net);
      return data;
    }),
    total,
  };
}

export async function createExpense(payload, { actor, settings }) {
  const amountCents = toCents(payload.amount);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw businessRule("amount must be greater than zero.");
  }
  const incurredOn = payload.incurredOn
    ? parseISODate(payload.incurredOn)
    : parseISODate(todayInTimeZone(settings?.timezone));
  if (!incurredOn) throw businessRule("incurredOn must be a valid calendar date (YYYY-MM-DD).");

  const expense = await Expense.create({
    category: payload.category,
    description: payload.description,
    amountCents,
    incurredOn,
    recordedBy: actor,
  });
  await recordAudit({
    actor,
    action: "expense.create",
    entityType: "Expense",
    entityId: expense._id,
    after: expense,
  });
  return serializeExpense(expense);
}

export async function addExpenseAdjustment(id, payload, { actor }) {
  const expense = await findExpenseOrThrow(id);
  const amountCents = toCents(payload.amount);
  if (!Number.isInteger(amountCents) || amountCents === 0) {
    throw businessRule("Adjustment amount must be a non-zero number.");
  }
  const existing = await ExpenseAdjustment.find({ originalExpense: expense._id });
  const existingSum = existing.reduce((sum, item) => sum + item.amountCents, 0);
  if (expense.amountCents + existingSum + amountCents < 0) {
    throw businessRule("This adjustment would take the recorded expense below zero.");
  }
  const adjustment = await ExpenseAdjustment.create({
    originalExpense: expense._id,
    amountCents,
    reason: payload.reason,
    recordedBy: actor,
  });
  await recordAudit({
    actor,
    action: "expense.adjustment.create",
    entityType: "ExpenseAdjustment",
    entityId: adjustment._id,
    after: adjustment,
  });
  return {
    adjustment: serializeExpenseAdjustment(adjustment),
    expense: serializeExpense(expense),
    netAmount: fromCents(expense.amountCents + existingSum + amountCents),
    incurredOn: toISODate(expense.incurredOn),
  };
}
