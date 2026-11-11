"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import AdminFaqBrowser from "@/app/admin_recruiter/components/AdminFaqBrowser";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { useApplicantPortalAuthHeaders } from "./useApplicantPortalSession";
import { useApplicantPortalUi } from "./ApplicantPortalUiContext";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "./worker-schedule-typography";

const FAQ_SEARCH_INPUT_ID = "worker-help-support-faq-search";
const ACTION_ICON_GRAY = "#94A3B8";
const TICKETS_HREF = "/application/applicant-dashboard/tickets";

function ChatSendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      <path
        d="M1.33998 14L15.3333 8L1.33998 2L1.33331 6.66667L11.3333 8L1.33331 9.33333L1.33998 14Z"
        fill={ACTION_ICON_GRAY}
      />
    </svg>
  );
}

function HelpSupportActionRow({
  label,
  icon,
  onClick,
  href,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "flex h-14 w-full max-w-[330px] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-[14px] text-left text-base font-semibold leading-6 text-[#0F172A] transition hover:bg-[#FAFBFC]";

  if (href) {
    return (
      <Link href={href} className={className}>
        <span className="min-w-0 flex-1">{label}</span>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <span className="min-w-0 flex-1">{label}</span>
      {icon}
    </button>
  );
}

function firstNameFromSession(name: string | undefined | null): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

export function ApplicantHelpSupportTab() {
  const { session } = useApplicantPortal();
  const authHeaders = useApplicantPortalAuthHeaders();
  const { openRecruiterMessages } = useApplicantPortalUi();
  const [faqSearchVisible, setFaqSearchVisible] = useState(false);
  const greetingName = firstNameFromSession(session?.applicant.name);

  function focusFaqSearch() {
    setFaqSearchVisible(true);
    const section = document.getElementById("worker-help-faq-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById(FAQ_SEARCH_INPUT_ID)?.focus();
    }, 300);
  }

  return (
    <div className={WORKER_PORTAL_PAGE_PAD_CLASS}>
      <div className="mb-5">
        <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
          Hi {greetingName}!
        </h1>
        <p
          className={`${WORKER_SCHEDULE_TITLE_CLASS} mt-1`}
          style={WORKER_SCHEDULE_TITLE_STYLE}
        >
          How can we help?
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 lg:p-6">
        <div className="flex flex-col gap-3">
          <HelpSupportActionRow
            label="Send us message"
            onClick={() => openRecruiterMessages()}
            icon={<ChatSendIcon />}
          />
          <HelpSupportActionRow
            label="Open Ticket"
            href={TICKETS_HREF}
            icon={
              <ChevronRight
                className="h-5 w-5 shrink-0"
                style={{ color: ACTION_ICON_GRAY }}
                aria-hidden
              />
            }
          />
          <HelpSupportActionRow
            label="Search for help"
            onClick={focusFaqSearch}
            icon={
              <Search className="h-5 w-5 shrink-0" style={{ color: ACTION_ICON_GRAY }} aria-hidden />
            }
          />
        </div>

        <div id="worker-help-faq-section" className="mt-8">
          <AdminFaqBrowser
            variant="cards"
            loadingLabel="Loading help articles..."
            emptyConfiguredMessage="No FAQ articles are available yet."
            searchInputId={FAQ_SEARCH_INPUT_ID}
            showSearchBar={faqSearchVisible}
            fetchUrl="/api/applicant-portal/help/faqs"
            getAuthHeaders={authHeaders}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-[#64748B]" style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
        Prefer a conversation? Open a ticket to chat with support about your request.
      </p>
    </div>
  );
}
