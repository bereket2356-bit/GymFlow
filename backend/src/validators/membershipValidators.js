import { z } from "zod";
import { confirmFlag, dateString, objectIdString } from "./common.js";

export const createMembershipBody = z
  .object({
    packageId: objectIdString,
    startDate: dateString.optional(),
    agreedPrice: z.coerce.number().min(0).max(1_000_000).optional(),
    confirm: confirmFlag,
  })
  .strict();

export const renewMembershipBody = z
  .object({
    packageId: objectIdString.optional(),
    startDate: dateString.optional(),
    agreedPrice: z.coerce.number().min(0).max(1_000_000).optional(),
    confirm: confirmFlag,
  })
  .strict();

export const cancelMembershipBody = z
  .object({
    reason: z.string().trim().min(2).max(240).optional(),
  })
  .strict();

export default { createMembershipBody, renewMembershipBody, cancelMembershipBody };
