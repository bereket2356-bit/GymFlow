import { z } from "zod";
import { isValidDateString } from "../utils/dates.js";

export const dateString = z
  .string()
  .trim()
  .refine(isValidDateString, "Use a valid calendar date in YYYY-MM-DD format.");

export const dateTimeString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Use a valid ISO 8601 timestamp.");

export const objectIdString = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/i, "Use a valid 24-character id.");

export const identifier = z.string().trim().min(1).max(64);

export const phoneString = z
  .string()
  .trim()
  .min(7)
  .max(40)
  .regex(/^[+0-9][0-9 ()-]{6,}$/, "Enter a valid phone number.");

export const baseListQuery = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().trim().max(100).optional(),
  })
  .strict();

export const idParams = z.object({ id: identifier }).strict();

export const confirmFlag = z.boolean().optional();

export function strictObject(shape) {
  return z.object(shape).strict();
}

export const optionalEmail = z.string().trim().email().max(160).nullable().optional();
