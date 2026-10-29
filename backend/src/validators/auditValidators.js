import { z } from "zod";
import { baseListQuery, dateString } from "./common.js";

export const listAuditQuery = baseListQuery
  .extend({
    entityType: z.string().trim().max(60).optional(),
    entityId: z.string().trim().max(64).optional(),
    action: z.string().trim().max(80).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strict();

export default { listAuditQuery };
