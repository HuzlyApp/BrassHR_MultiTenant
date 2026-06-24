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
};

/** Shared list-page title block — matches Candidates / Workers shell. */
export function CandidatesPageHeader({
  title,
  subtitle,
  variant = "card",
}: CandidatesPageHeaderProps) {
  const wrapperClass =
    variant === "page" ? "pb-5" : "px-[14px] pb-4 pt-5";

  return (
    <div className={wrapperClass}>
      <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
        {title}
      </h1>
      <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
        {subtitle}
      </p>
    </div>
  );
}
