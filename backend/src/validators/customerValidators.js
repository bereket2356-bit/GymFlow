import { z } from "zod";
import { baseListQuery, dateString, optionalEmail, phoneString } from "./common.js";

export const createCustomerBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: phoneString,
    email: optionalEmail,
    notes: z.string().trim().max(2000).optional(),
    registeredAt: dateString.optional(),
  })
  .strict();

export const updateCustomerBody = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: phoneString.optional(),
    email: optionalEmail,
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const listCustomersQuery = baseListQuery
  .extend({
    search: z.string().trim().max(120).optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .strict();

export const attendanceQuery = z
  .object({
    days: z.coerce.number().int().min(1).max(365).optional(),
  })
  .strict();

export default { createCustomerBody, updateCustomerBody, listCustomersQuery, attendanceQuery };
