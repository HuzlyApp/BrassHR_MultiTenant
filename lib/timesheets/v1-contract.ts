import { z } from "zod";
import { EASTERN_TIME_ZONE } from "@/lib/datetime/eastern";
export { EASTERN_TIME_ZONE };
const page = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};
const filters = {
  facility_id: z.uuid().optional(),
  department_id: z.uuid().optional(),
  worker_id: z.uuid().optional(),
};
export const clockEventSchema = z
  .object({
    action: z.enum(["clock_in", "clock_out", "break_start", "break_end"]),
    worker_id: z.uuid().optional(),
    facility_id: z.uuid().optional(),
    shift_id: z.uuid().optional(),
    location: z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
        permissionStatus: z.literal("granted"),
        timestamp: z.iso.datetime({ offset: true }),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (v) =>
      !["clock_in", "clock_out"].includes(v.action) || v.location !== undefined,
    "Location permission required",
  );
export const timesheetListSchema = z
  .object({
    ...page,
    ...filters,
    period_start: z.iso.date(),
    period_end: z.iso.date(),
    status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
  })
  .refine(
    (v) =>
      v.period_start <= v.period_end &&
      Date.parse(v.period_end) - Date.parse(v.period_start) <= 366 * 86400000,
    "Invalid period range",
  );
export const clockInsSchema = z.object({
  ...page,
  ...filters,
  date: z.iso.date().optional(),
  status: z
    .enum(["On Shift", "Not Clocked In", "On Break", "Completed"])
    .optional(),
});
export const timesheetReviewSchema = z
  .object({ notes: z.string().trim().max(4000).optional() })
  .strict();
export type TimesheetListInput = z.infer<typeof timesheetListSchema>;
export class TimeApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
