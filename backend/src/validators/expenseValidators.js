import { z } from "zod";
import { baseListQuery, dateString } from "./common.js";

export const createExpenseBody = z
  .object({
    category: z.string().trim().min(2).max(60),
    description: z.string().trim().min(2).max(240),
    amount: z.coerce.number().positive().max(1_000_000),
    incurredOn: dateString.optional(),
  })
  .strict();

export const listExpensesQuery = baseListQuery
  .extend({
    from: dateString.optional(),
    to: dateString.optional(),
    category: z.string().trim().max(60).optional(),
  })
  .strict();

export const expenseAdjustmentBody = z
  .object({
    amount: z.coerce.number().refine((value) => value !== 0, "Amount must be non-zero."),
    reason: z.string().trim().min(3).max(240),
  })
  .strict();

export default { createExpenseBody, listExpensesQuery, expenseAdjustmentBody };
