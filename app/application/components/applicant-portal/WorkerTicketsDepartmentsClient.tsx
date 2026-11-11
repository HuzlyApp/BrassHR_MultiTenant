"use client";

import { useState } from "react";
import { CreateSupportTicketModal } from "@/app/application/components/applicant-portal/CreateSupportTicketModal";
import { WorkerTicketsSubNav } from "@/app/application/components/applicant-portal/WorkerTicketsSubNav";
import {
  isWorkerSupportDeskOnline,
  WORKER_SUPPORT_DEPARTMENTS,
} from "@/app/application/components/applicant-portal/worker-support-departments";
import { useApplicantPortalAuthHeaders } from "@/app/application/components/applicant-portal/useApplicantPortalSession";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "@/app/application/components/applicant-portal/worker-schedule-typography";

export function WorkerTicketsDepartmentsClient() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState("general");
  const online = isWorkerSupportDeskOnline();

  function openCreate(category: string) {
    setDefaultCategory(category);
    setCreateOpen(true);
  }

  const openTicketAction = (
    <button
      type="button"
      onClick={() => openCreate("general")}
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

      <div className="grid gap-4 sm:grid-cols-2">
        {WORKER_SUPPORT_DEPARTMENTS.map((dept) => (
          <article
            key={dept.id}
            className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-[#0F172A]">{dept.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#64748B]">{dept.description}</p>
            <button
              type="button"
              onClick={() => openCreate(dept.category)}
              className="mt-5 min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              }}
            >
              Open a Ticket
            </button>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                  online ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#B91C1C]"
                }`}
              >
                {online ? "Online" : "Offline"}
              </span>
              <span className="text-xs text-[#64748B]">{dept.hoursLabel}</span>
            </div>
          </article>
        ))}
      </div>

      <CreateSupportTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultCategory={defaultCategory}
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
