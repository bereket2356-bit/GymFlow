import { z } from "zod";

export const summaryQuery = z
  .object({
    period: z.enum(["month", "7d", "30d", "quarter"]).optional(),
  })
  .strict();

export const reminderKeyParams = z
  .object({
    key: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z_]+:[A-Za-z0-9-]+$/, "Invalid reminder key."),
  })
  .strict();

export default { summaryQuery, reminderKeyParams };
