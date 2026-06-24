"use client";

import AdminFaqBrowser from "@/app/admin_recruiter/components/AdminFaqBrowser";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";

export default function KnowledgebaseClient() {
  return (
    <div className="pb-8">
      <div className="px-8 pt-6">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Knowledgebase
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          Help articles used by the applicant AI assistant
        </p>
      </div>

      <TicketsSubNav />

      <AdminFaqBrowser className="px-8" loadingLabel="Loading knowledgebase..." />
    </div>
  );
}
