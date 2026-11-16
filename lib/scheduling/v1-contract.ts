import { z } from "zod";

export const OFF_TYPES = ["Vacation", "Sick Leave", "Personal Leave", "Training", "Regular Off"] as const;
const date = z.iso.date();
const optionalId = z.uuid().nullable().optional();
const pagination = { page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) };
const rangeFields = { date_from: date, date_to: date };
const validRange = (input: { date_from: string; date_to: string }) => input.date_from <= input.date_to &&
  Date.parse(input.date_to) - Date.parse(input.date_from) <= 366 * 86400000;

export const scheduleQuerySchema = z.object({ ...rangeFields, ...pagination,
  facility_id: z.uuid().optional(), department_id: z.uuid().optional(), view: z.enum(["calendar", "list"]).default("calendar"),
}).refine(validRange, "Date range must be ordered and no longer than 366 days");
export const whoIsOffQuerySchema = z.object({ ...rangeFields, ...pagination,
  facility_id: z.uuid().optional(), department_id: z.uuid().optional(), off_type: z.enum([...OFF_TYPES, "Holiday"]).optional(),
}).refine(validRange, "Date range must be ordered and no longer than 366 days");
export const holidayQuerySchema = z.object({ ...pagination, date_from: date.optional(), date_to: date.optional() })
  .refine((v) => !v.date_from || !v.date_to || v.date_from <= v.date_to, "Invalid date range");
export const holidaySchema = z.object({ name: z.string().trim().min(1).max(120), holiday_date: date, is_paid: z.boolean() }).strict();

const shiftFields = {
  title: z.string().trim().min(1).max(120), description: z.string().trim().max(4000).nullable().optional(),
  start_date: date, end_date: date, facility_id: optionalId, department_id: optionalId, client_id: optionalId,
  is_internal: z.boolean(), job_category_id: optionalId,
  number_of_people_needed: z.number().int().min(1).max(100000),
  rate_per_hour: z.number().finite().min(0).max(999999999).nullable().optional(),
};
export const shiftSchema = z.object({ ...shiftFields, number_of_people_needed: shiftFields.number_of_people_needed.default(1) })
  .strict().refine((v) => v.end_date >= v.start_date, "Invalid shift dates");
export const shiftPatchSchema = z.object(shiftFields).partial().strict()
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");
export const assignmentSchema = z.object({ worker_ids: z.array(z.uuid()).min(1).max(100)
  .refine((ids) => new Set(ids).size === ids.length, "Workers must be distinct"),
  start_date: date.optional(), end_date: date.optional(),
  pay_rate: z.number().finite().min(0).max(999999999).nullable().optional(),
  bill_rate: z.number().finite().min(0).max(999999999).nullable().optional(),
}).strict().refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, "Invalid assignment dates");

export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;
export type WhoIsOffQuery = z.infer<typeof whoIsOffQuerySchema>;
export type HolidayQuery = z.infer<typeof holidayQuerySchema>;
export type ShiftInput = z.infer<typeof shiftSchema>;

export class SchedulingError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}
