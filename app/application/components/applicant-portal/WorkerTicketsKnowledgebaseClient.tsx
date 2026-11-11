"use client";

import { useState } from "react";
import AdminFaqBrowser from "@/app/admin_recruiter/components/AdminFaqBrowser";
import { CreateSupportTicketModal } from "@/app/application/components/applicant-portal/CreateSupportTicketModal";
import { WorkerTicketsSubNav } from "@/app/application/components/applicant-portal/WorkerTicketsSubNav";
import { useApplicantPortalAuthHeaders } from "@/app/application/components/applicant-portal/useApplicantPortalSession";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "@/app/application/components/applicant-portal/worker-schedule-typography";

export function WorkerTicketsKnowledgebaseClient() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const [createOpen, setCreateOpen] = useState(false);

  const openTicketAction = (
    <button
      type="button"
      onClick={() => setCreateOpen(true)}
      className="min-h-11 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white"
      style={{
        background: "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
      }}
    >
      Open a Ticket
    </button>
  );

  return (
    <div className={WORKER_PORTAL_PAGE_PAD_CLASS}>
      <div className="mb-1">
        <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
          Support Tickets
        </h1>
        <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
          Manage your help tickets
        </p>
      </div>

      <WorkerTicketsSubNav action={openTicketAction} />

      <AdminFaqBrowser
        variant="sidebar"
        sectionTitle="Knowledgebase"
        loadingLabel="Loading knowledgebase..."
        emptyConfiguredMessage="No help articles are available yet."
        fetchUrl="/api/applicant-portal/help/faqs"
        getAuthHeaders={authHeaders}
      />

      <CreateSupportTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        submitEndpoint="/api/support-tickets"
        authHeaders={authHeaders}
        successActionLabel="View Ticket"
        successActionHrefForTicket={(ticketId) =>
          `/application/applicant-dashboard/tickets?ticket=${encodeURIComponent(ticketId)}`
        }
      />
    </div>
  );
}
