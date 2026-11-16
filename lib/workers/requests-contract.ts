import { z } from "zod";
import { OFF_TYPES } from "@/lib/scheduling/v1-contract";

export const REQUEST_TYPES = ["time_off", "schedule_change", "time_adjustment", "other"] as const;
export const requestCreateSchema = z.object({
  worker_id: z.uuid().optional(),
  request_type: z.enum(REQUEST_TYPES),
  start_date: z.iso.date(), end_date: z.iso.date(),
  reason: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(4000).optional(),
  off_type: z.enum(OFF_TYPES).optional(),
  facility_id: z.uuid().nullable().optional(),
  department_id: z.uuid().nullable().optional(),
  related_shift_id: z.uuid().nullable().optional(),
}).strict().refine((v) => v.end_date >= v.start_date, "Invalid dates")
  .refine((v) => v.request_type === "time_off" || v.off_type === undefined, "Leave type is only valid for time off");

export const requestListSchema = z.object({
  type: z.enum(REQUEST_TYPES).optional(), status: z.enum(["pending", "approved", "rejected"]).optional(),
  facility_id: z.uuid().optional(), department_id: z.uuid().optional(),
  date_from: z.iso.date().optional(), date_to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).refine((v) => !v.date_from || !v.date_to || v.date_from <= v.date_to, "Invalid dates");
export const requestReviewSchema = z.object({ notes: z.string().trim().max(4000).optional() }).strict();
export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type RequestListInput = z.infer<typeof requestListSchema>;

export class WorkerRequestError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}
