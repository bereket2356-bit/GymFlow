import { z } from "zod";

export const updateSettingsBody = z
  .object({
    gymName: z.string().trim().min(2).max(120).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "Currency must be a three-letter code.")
      .transform((value) => value.toUpperCase())
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    reminderWindows: z
      .array(z.coerce.number().int().min(1).max(365))
      .min(1)
      .max(10)
      .optional(),
    inactivityDays: z.coerce.number().int().min(1).max(365).optional(),
    dateCountingRule: z.enum(["start_day_is_day_one", "start_day_is_day_zero"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one setting to update.");

export default { updateSettingsBody };
