import type { CSSProperties } from "react";
import {
  BRAND_FONT_BODY_STYLE,
  BRAND_FONT_HEADING_STYLE,
} from "@/lib/tenant/branding-typography-styles";

/** Figma: Candidates page title */
export const CANDIDATES_PAGE_TITLE_CLASS =
  "m-0 text-xl font-semibold leading-7 tracking-normal text-[#1d2739] sm:text-[30px] sm:leading-9";

export const CANDIDATES_PAGE_TITLE_STYLE: CSSProperties = {
  ...BRAND_FONT_HEADING_STYLE,
};

/** Figma: Candidates page subtitle — "Manage candidates in one place" */
export const CANDIDATES_PAGE_SUBTITLE_CLASS =
  "m-0 mt-0.5 text-sm font-normal leading-5 tracking-normal text-[#6f7683] sm:mt-1 sm:text-[16px] sm:leading-6";

export const CANDIDATES_PAGE_SUBTITLE_STYLE: CSSProperties = {
  ...BRAND_FONT_BODY_STYLE,
};

/** Figma: inline filter labels — Job Role, Location, Date Applied */
export const CANDIDATES_FILTER_LABEL_CLASS =
  "shrink-0 text-[14px] font-normal leading-6 tracking-normal text-[#475569] align-middle whitespace-nowrap";

export const CANDIDATES_FILTER_CONTROL_CLASS =
  "h-10 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2.5 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 sm:h-8 sm:min-w-[100px] sm:max-w-[160px] sm:w-auto appearance-auto cursor-pointer";
