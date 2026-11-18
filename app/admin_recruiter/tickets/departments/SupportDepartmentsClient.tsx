"use client";

import { useState } from "react";
import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";
import { OpenTicketDepartmentMenu } from "@/app/components/support/OpenTicketDepartmentMenu";
import { StaffCreateSupportTicketModal } from "@/app/admin_recruiter/tickets/support/StaffCreateSupportTicketModal";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  BRAND_FONT_BODY_STYLE,
  BRAND_FONT_HEADING_STYLE,
} from "@/lib/tenant/branding-typography-styles";
import {
  SUPPORT_DEPARTMENTS,
  // isSupportDeskOnline,
} from "@/lib/support-tickets/support-departments";
import type { SupportTicketListItem } from "@/lib/support-tickets/types";

export default function SupportDepartmentsClient() {
  const branding = useTenantBranding();
  const secondaryColor = branding.secondaryHex || "#012352";
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState("general");
  // const online = isSupportDeskOnline();

  function openCreate(category: string) {
    setDefaultCategory(category);
    setCreateOpen(true);
  }

  function handleCreated(_ticket: SupportTicketListItem) {
    setCreateOpen(false);
  }

  const openTicketAction = (
    <OpenTicketDepartmentMenu
      onSelectDepartment={openCreate}
      buttonStyle={{ backgroundColor: secondaryColor }}
    />
  );

  return (
    <div className="pb-8">
      <div className="px-8 pt-6">
        <h1
          className="m-0 text-2xl font-semibold leading-8 tracking-normal text-[color:var(--brand-secondary,#012352)]"
          style={BRAND_FONT_HEADING_STYLE}
        >
          Support Tickets
        </h1>
        <p
          className="m-0 mt-0.5 text-xs font-normal leading-4 tracking-normal text-[#6B7280]"
          style={BRAND_FONT_BODY_STYLE}
        >
          Manage your help tickets.
        </p>
      </div>

      <TicketsSubNav action={openTicketAction} />

      <div className="px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {SUPPORT_DEPARTMENTS.map((dept) => (
            <article
              key={dept.id}
              className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm"
            >
              <h2
                className="text-base font-semibold text-[#0F172A]"
                style={BRAND_FONT_HEADING_STYLE}
              >
                {dept.title}
              </h2>
              <p
                className="mt-2 flex-1 text-sm leading-6 text-[#64748B]"
                style={BRAND_FONT_BODY_STYLE}
              >
                {dept.description}
              </p>
              <button
                type="button"
                onClick={() => openCreate(dept.category)}
                className="mt-5 min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                style={{ backgroundColor: secondaryColor }}
              >
                Open a Ticket
              </button>
              {/* Online/Offline status + hours — hidden for now
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
                    online ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#B91C1C]"
                  }`}
                >
                  {online ? "Online" : "Offline"}
                </span>
                <span className="text-xs text-[#64748B]" style={BRAND_FONT_BODY_STYLE}>
                  {dept.hoursLabel}
                </span>
              </div>
              */}
            </article>
          ))}
        </div>
      </div>

      <StaffCreateSupportTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleCreated}
        defaultCategory={defaultCategory}
        requireWorker={false}
      />
    </div>
  );
}
