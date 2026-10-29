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

export default { loginBody };
