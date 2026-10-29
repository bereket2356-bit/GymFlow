import { z } from "zod";

export const loginBody = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(200)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(200),
  })
  .strict();

export const updateProfileBody = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    displayName: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((val) => (val === "" ? null : val)),
    phone: z
      .string()
      .trim()
      .refine(
        (val) => val === "" || /^[\d\s\-()+]{7,20}$/.test(val),
        "Phone must be 7-20 characters with numbers, spaces, dashes, parentheses, or plus signs only",
      )
      .nullable()
      .optional()
      .transform((val) => (val === "" ? null : val)),
    email: z
      .string()
      .trim()
      .email()
      .max(200)
      .transform((val) => val.toLowerCase())
      .optional(),
    currentPassword: z.string().optional(),
  })
  .strict();

export const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(12, "New password must be at least 12 characters")
      .regex(/[a-zA-Z]/, "New password must contain at least one letter")
      .regex(/\d/, "New password must contain at least one number"),
  })
  .strict();

export const signOutAllBody = z
  .object({
    currentPassword: z.string().min(1),
  })
  .strict();

export default { loginBody, updateProfileBody, changePasswordBody, signOutAllBody };
