import { z } from "zod";
import { PAYMENT_METHODS } from "../models/Payment.js";
import { baseListQuery, dateString, identifier } from "./common.js";

export const createPaymentBody = z
  .object({
    customerId: identifier,
    membershipId: identifier.optional(),
    amount: z.coerce.number().positive().max(1_000_000),
    method: z.enum(PAYMENT_METHODS),
    receivedOn: dateString.optional(),
    reference: z.string().trim().max(80).optional().nullable(),
  })
  .strict();

export const adjustmentBody = z
  .object({
    amount: z.coerce.number().refine((value) => value !== 0, "Amount must be non-zero."),
    reason: z.string().trim().min(3).max(240),
  })
  .strict();

export const listPaymentsQuery = baseListQuery
  .extend({
    customerId: identifier.optional(),
    membershipId: identifier.optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strict();

export default { createPaymentBody, adjustmentBody, listPaymentsQuery };
