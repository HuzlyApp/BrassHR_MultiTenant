"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { DepartmentRecord } from "@/lib/departments/types";
import type { SupportTicketListItem } from "@/lib/support-tickets/types";

type DepartmentCard = {
  id: string;
  category: string;
  title: string;
  description: string;
};

export default function SupportDepartmentsClient() {
  const branding = useTenantBranding();
  const secondaryColor = branding.secondaryHex || "#012352";
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState("");
  const [orgDepartments, setOrgDepartments] = useState<DepartmentRecord[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  // const online = isSupportDeskOnline();

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoadingDepartments(true);
      try {
        const response = await fetch("/api/admin/departments", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load departments");
        if (alive) setOrgDepartments((payload.departments ?? []) as DepartmentRecord[]);
      } catch {
        if (alive) setOrgDepartments([]);
      } finally {
        if (alive) setLoadingDepartments(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cards = useMemo<DepartmentCard[]>(() => {
    const active = orgDepartments.filter((row) => row.isActive);
    if (active.length > 0) {
      return active.map((row) => ({
        id: row.id,
        category: row.id,
        title: row.name,
        description:
          row.description?.trim() ||
          (row.primaryContact
            ? `Tickets route to ${row.primaryContact}`
            : "Open a ticket for this department."),
      }));
    }
    return SUPPORT_DEPARTMENTS.map((dept) => ({
      id: dept.id,
      category: dept.category,
      title: dept.title,
      description: dept.description,
    }));
  }, [orgDepartments]);

  const menuDepartments = useMemo(
    () =>
      cards.map((dept) => ({
        id: dept.id,
        category: dept.category,
        title: dept.title,
        description: dept.description,
      })),
    [cards]
  );

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
      departments={menuDepartments}
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
        {loadingDepartments ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((dept) => (
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
              </article>
            ))}
          </div>
        )}
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
