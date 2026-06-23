import type { CSSProperties } from "react";

/** Figma: worker schedule page title — "Schedules" */
export const WORKER_SCHEDULE_TITLE_CLASS =
  "text-[30px] font-semibold leading-9 tracking-normal text-black align-middle";

export const WORKER_SCHEDULE_TITLE_STYLE: CSSProperties = {
  fontFamily: "Inter, Arial, sans-serif",
};

/** Figma: worker schedule page subtitle */
export const WORKER_SCHEDULE_SUBTITLE_CLASS =
  "mt-1 text-[16px] font-normal leading-6 tracking-normal text-[#6B7280] align-middle";

export const WORKER_SCHEDULE_SUBTITLE_STYLE: CSSProperties = {
  fontFamily: "Inter, Arial, sans-serif",
};

/** Figma: card section titles — Timer, Clock-In, Clock Out, Schedules, etc. */
export const WORKER_SECTION_TITLE_CLASS =
  "text-[14px] font-semibold leading-5 tracking-normal text-black align-middle";

export const WORKER_SECTION_TITLE_STYLE: CSSProperties = {
  fontFamily: "Inter, Arial, sans-serif",
};

export const WORKER_SCHEDULE_CARD_CLASS =
  "overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white";

/** Shared horizontal padding for worker portal pages (matches dashboard). */
export const WORKER_PORTAL_PAGE_PAD_CLASS =
  "w-full min-w-0 px-4 py-5 min-[1000px]:px-8";

/** Figma: request schedule row — dropdown + button share width (+15% for label fit) */
export const WORKER_SCHEDULE_ACTION_CONTROL_CLASS =
  "h-10 w-full shrink-0 rounded-lg sm:w-[193px]";

/** Figma: timesheet day label — "Today" */
export const WORKER_TIMESHEET_DAY_CLASS =
  "text-[14px] font-semibold leading-5 tracking-normal text-black align-middle";

/** Figma: timesheet field labels — Clock-in, Clock-out */
export const WORKER_TIMESHEET_LABEL_CLASS =
  "text-[14px] font-semibold leading-5 tracking-normal text-[#6B7280] align-middle";

/** Figma: timesheet time values */
export const WORKER_TIMESHEET_VALUE_CLASS =
  "text-[14px] font-semibold leading-5 tracking-normal text-black align-middle";

/** Figma: timesheet duration meta text */
export const WORKER_TIMESHEET_DURATION_CLASS =
  "text-[14px] font-normal leading-5 tracking-normal text-[#6B7280] align-middle";

/** Figma: timesheet legend + timeline marks */
export const WORKER_TIMESHEET_META_CLASS =
  "text-[12px] font-normal leading-5 tracking-normal text-[#6B7280] align-middle";

export const WORKER_TIMESHEET_FONT_STYLE: CSSProperties = {
  fontFamily: "Inter, Arial, sans-serif",
};

/** Figma: date range controls — Last 7 days / calendar */
export const WORKER_TIMESHEET_RANGE_CONTROL_CLASS =
  "inline-flex h-10 items-center gap-1.5 border border-[#E5E7EB] bg-white px-3 text-[14px] font-normal leading-5 text-[#374151]";
