import { z } from "zod";
import { dateString } from "./common.js";

export const reportQuery = z
  .object({
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strict();

export const weeklyQuery = z
  .object({
    weeks: z.coerce.number().int().min(1).max(26).optional(),
    to: dateString.optional(),
  })
  .strict();

export const exportQuery = z
  .object({
    type: z.enum(["summary", "payments", "outstanding", "attendance"]),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strict();

export default { reportQuery, weeklyQuery, exportQuery };
