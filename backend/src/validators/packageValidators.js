import { z } from "zod";
import { baseListQuery, confirmFlag } from "./common.js";

const packageFields = {
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional(),
  type: z.enum(["time", "session", "both"]),
  validityValue: z.coerce.number().int().min(1).max(365),
  validityUnit: z.enum(["days", "weeks", "months", "years"]),
  sessionAllowance: z.coerce.number().int().min(1).max(500),
  price: z.coerce.number().min(0).max(1_000_000),
  status: z.enum(["active", "inactive"]).optional(),
};

export const createPackageBody = z.object(packageFields).strict();

export const updatePackageBody = z
  .object({
    ...packageFields,
    name: packageFields.name.optional(),
    description: packageFields.description,
    type: packageFields.type.optional(),
    validityValue: packageFields.validityValue.optional(),
    validityUnit: packageFields.validityUnit.optional(),
    sessionAllowance: packageFields.sessionAllowance.optional(),
    price: packageFields.price.optional(),
    confirm: confirmFlag,
  })
  .strict()
  .refine((value) => {
    const { confirm, ...rest } = value;
    return Object.keys(rest).length > 0;
  }, "Provide at least one field to update.");

export const packageStatusBody = z.object({ confirm: confirmFlag }).strict();

export const listPackagesQuery = baseListQuery
  .extend({
    status: z.enum(["active", "inactive"]).optional(),
    type: z.enum(["time", "session", "both"]).optional(),
    search: z.string().trim().max(120).optional(),
  })
  .strict();

export default {
  createPackageBody,
  updatePackageBody,
  packageStatusBody,
  listPackagesQuery,
};
