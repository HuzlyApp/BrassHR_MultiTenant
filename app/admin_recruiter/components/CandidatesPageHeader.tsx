import type { ReactNode } from "react";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";

type CandidatesPageHeaderProps = {
  title: string;
  subtitle: string;
  /** `card` = inside bordered list shell; `page` = standalone page with outer padding */
  variant?: "card" | "page";
  actions?: ReactNode;
};

/** Shared list-page title block — matches Candidates / Workers shell. */
export function CandidatesPageHeader({
  title,
  subtitle,
  variant = "card",
  actions,
}: CandidatesPageHeaderProps) {
  const wrapperClass =
    variant === "page"
      ? "flex flex-wrap items-center justify-between gap-3 py-2"
      : "px-3 pb-3 pt-3 sm:px-[14px] sm:pb-4 sm:pt-5";

  return (
    <div className={wrapperClass}>
      <div className="min-w-0">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          {title}
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          {subtitle}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
