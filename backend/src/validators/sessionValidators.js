import { z } from "zod";
import { ATTENDANCE_STATUSES } from "../models/Attendance.js";
import { baseListQuery, dateString, dateTimeString, identifier } from "./common.js";

const sessionFields = {
  title: z.string().trim().min(2).max(120),
  startsAt: dateTimeString,
  durationMinutes: z.coerce.number().int().min(5).max(480),
  capacity: z.coerce.number().int().min(1).max(200),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  instructor: z.string().trim().max(120).nullable().optional(),
};

export const createSessionBody = z.object(sessionFields).strict();

export const updateSessionBody = z
  .object({
    ...sessionFields,
    title: sessionFields.title.optional(),
    startsAt: sessionFields.startsAt.optional(),
    durationMinutes: sessionFields.durationMinutes.optional(),
    capacity: sessionFields.capacity.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const listSessionsQuery = baseListQuery
  .extend({
    from: dateString.optional(),
    to: dateString.optional(),
    status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  })
  .strict();

export const bulkAttendanceBody = z
  .object({
    entries: z
      .array(
        z
          .object({
            customerId: identifier,
            status: z.enum(ATTENDANCE_STATUSES),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export default {
  createSessionBody,
  updateSessionBody,
  listSessionsQuery,
  bulkAttendanceBody,
};
