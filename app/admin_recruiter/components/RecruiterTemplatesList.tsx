"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronDown, FileSignature, Plus, Search } from "lucide-react";
import { recruiterTemplateFetch } from "@/app/admin_recruiter/components/recruiter-template-auth";
import {
  RECRUITER_TEMPLATE_CATEGORIES,
  RECRUITER_TEMPLATE_CATEGORY_LABELS,
  RECRUITER_TEMPLATE_STATUSES,
} from "@/lib/recruiter-templates/constants";
import type { RecruiterTemplateListItem } from "@/lib/recruiter-templates/types";

type ListResponse = {
  templates?: RecruiterTemplateListItem[];
  error?: string;
  code?: string;
  detail?: string;
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "archived":
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
    default:
      return "bg-amber-50 text-amber-800 ring-amber-600/20";
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const fieldClassName =
  "w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1.5 text-[13px] text-[#101828] outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)] min-[700px]:px-3 min-[700px]:py-2 min-[700px]:text-sm";

const selectClassName = `${fieldClassName} cursor-pointer appearance-none pr-9 min-[700px]:pr-10`;

const actionBtnClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-[#D0D5DD] px-2 py-1 text-[11px] font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50 min-[700px]:px-2.5 min-[700px]:py-1.5 min-[700px]:text-xs";

const actionDangerClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-[#D0D5DD] px-2 py-1 text-[11px] font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-50 min-[700px]:px-2.5 min-[700px]:py-1.5 min-[700px]:text-xs";

const actionDeleteClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-[#FDA29B] px-2 py-1 text-[11px] font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-50 min-[700px]:px-2.5 min-[700px]:py-1.5 min-[700px]:text-xs";

function TemplateActions({
  template,
  busy,
  onAction,
}: {
  template: RecruiterTemplateListItem;
  busy: boolean;
  onAction: (action: "duplicate" | "archive" | "delete" | "signing-request") => void;
}) {
  return (
    <div className="flex flex-nowrap items-center justify-end gap-1.5 min-[700px]:gap-2">
      <Link
        href={`/admin_recruiter/template-builder/${template.id}`}
        className={actionBtnClass}
      >
        Edit
      </Link>
      <Link
        href={`/admin_recruiter/template-builder/${template.id}?preview=1`}
        className={actionBtnClass}
      >
        Preview
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction("duplicate")}
        className={actionBtnClass}
      >
        Duplicate
      </button>
      {template.status === "active" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("signing-request")}
          className={actionBtnClass}
        >
          Signing request
        </button>
      ) : null}
      {template.status !== "archived" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("archive")}
          className={actionDangerClass}
        >
          Archive
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("delete")}
          className={actionDeleteClass}
        >
          Delete
        </button>
      )}
    </div>
  );
}

export default function RecruiterTemplatesList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<RecruiterTemplateListItem[]>([]);
  const [tenantMissing, setTenantMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [search, statusFilter, categoryFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recruiterTemplateFetch(`/api/admin/recruiter-templates${queryString}`);
      const payload = (await res.json()) as ListResponse;
      if (!res.ok) {
        if (payload.code === "TENANT_REQUIRED") {
          setTenantMissing(true);
          setTemplates([]);
          return;
        }
        throw new Error(payload.detail ?? payload.error ?? "Failed to load templates");
      }
      setTenantMissing(false);
      setTemplates(payload.templates ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (
    templateId: string,
    action: "duplicate" | "archive" | "delete" | "signing-request"
  ) => {
    setActionId(templateId);
    try {
      if (action === "duplicate") {
        const res = await recruiterTemplateFetch(
          `/api/admin/recruiter-templates/${templateId}/duplicate`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
        );
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Duplicate failed");
        toast.success("Template duplicated");
        router.push(`/admin_recruiter/template-builder/${payload.template.id}`);
        return;
      }

      if (action === "archive") {
        const res = await recruiterTemplateFetch(`/api/admin/recruiter-templates/${templateId}`, {
          method: "DELETE",
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Archive failed");
        toast.success("Template archived");
        void load();
        return;
      }

      if (action === "delete") {
        if (!window.confirm("Permanently delete this template? This cannot be undone.")) return;
        const res = await recruiterTemplateFetch(
          `/api/admin/recruiter-templates/${templateId}?hard=true`,
          { method: "DELETE" }
        );
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Delete failed");
        toast.success("Template deleted");
        void load();
        return;
      }

      if (action === "signing-request") {
        const res = await recruiterTemplateFetch(
          `/api/admin/recruiter-templates/${templateId}/signing-request?mode=duplicate`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
        );
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Could not create signing request");
        toast.success(`Signing request created (${payload.signing_request_id})`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-3 min-[700px]:space-y-6">
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between lg:items-center">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-6 text-[#101828] min-[700px]:text-xl min-[700px]:leading-7">
            Template Builder
          </h1>
          <p className="mt-0.5 text-[12px] leading-4 text-[#667085] min-[700px]:mt-1 min-[700px]:text-sm min-[700px]:leading-5">
            Create and manage Firma.dev e-signature templates for recruiting workflows.
          </p>
        </div>
        <Link
          href="/admin_recruiter/template-builder/new"
          className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[color:var(--brand-primary)] to-[color:var(--brand-accent)] px-3 text-[13px] font-semibold text-white shadow-sm min-[480px]:w-auto min-[700px]:h-10 min-[700px]:gap-2 min-[700px]:px-4 min-[700px]:text-sm"
        >
          <Plus className="h-3.5 w-3.5 min-[700px]:h-4 min-[700px]:w-4" />
          New template
        </Link>
      </div>

      {tenantMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-sm">
          <p className="font-semibold">Tenant required</p>
          <p className="mt-1">
            Select a tenant using the tenant switcher in the header before managing templates.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border border-[#EAECF0] bg-white p-3 min-[700px]:flex-row min-[700px]:flex-wrap min-[700px]:items-center min-[700px]:gap-3 min-[700px]:p-4">
        <div className="flex h-9 w-full min-w-0 max-w-none items-center rounded-md border border-[#D0D5DD] bg-white px-2.5 transition-colors focus-within:border-[color:var(--brand-primary)] focus-within:ring-1 focus-within:ring-[color:var(--brand-primary)] min-[700px]:h-9 min-[700px]:max-w-[360px] min-[700px]:px-3">
          <Search
            className="mr-1.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-primary)] min-[700px]:mr-2 min-[700px]:h-4 min-[700px]:w-4"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#101828] outline-none placeholder:text-[#98A2B3] min-[700px]:text-sm"
          />
        </div>
        <div className="relative w-full min-[700px]:ml-auto min-[700px]:w-auto min-[700px]:min-w-[140px]">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClassName}
          >
            <option value="">All statuses</option>
            {RECRUITER_TEMPLATE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667085] min-[700px]:right-3 min-[700px]:h-4 min-[700px]:w-4"
            aria-hidden
          />
        </div>
        <div className="relative w-full min-[700px]:w-auto min-[700px]:min-w-[160px]">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={selectClassName}
          >
            <option value="">All types</option>
            {RECRUITER_TEMPLATE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {RECRUITER_TEMPLATE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667085] min-[700px]:right-3 min-[700px]:h-4 min-[700px]:w-4"
            aria-hidden
          />
        </div>
      </div>

      {loading ? null : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-4 py-12 text-center min-[700px]:px-6 min-[700px]:py-16">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F4F7] min-[700px]:h-12 min-[700px]:w-12">
            <FileSignature className="h-5 w-5 text-[#667085] min-[700px]:h-6 min-[700px]:w-6" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-[#101828] min-[700px]:mt-4 min-[700px]:text-lg">
            No templates yet
          </h2>
          <p className="mt-1.5 text-[13px] text-[#667085] min-[700px]:mt-2 min-[700px]:text-sm">
            Create your first recruiting template to get started.
          </p>
          <Link
            href="/admin_recruiter/template-builder/new"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[color:var(--brand-primary)] px-3.5 py-2 text-[13px] font-semibold text-white min-[700px]:mt-6 min-[700px]:px-4 min-[700px]:py-2.5 min-[700px]:text-sm"
          >
            <Plus className="h-3.5 w-3.5 min-[700px]:h-4 min-[700px]:w-4" />
            Create your first recruiting template
          </Link>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto rounded-xl border border-[#EAECF0] bg-white min-[700px]:mx-0">
          <table className="min-w-[640px] w-full divide-y divide-[#EAECF0] text-[12px] min-[700px]:min-w-[720px] min-[700px]:text-sm">
            <thead className="bg-[#F9FAFB]">
              <tr>
                <th className="px-2.5 py-2 text-left text-[11px] font-medium text-[#667085] min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-sm">
                  Name
                </th>
                <th className="px-2.5 py-2 text-left text-[11px] font-medium text-[#667085] min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-sm">
                  Type
                </th>
                <th className="px-2.5 py-2 text-left text-[11px] font-medium text-[#667085] min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-sm">
                  Status
                </th>
                <th className="px-2.5 py-2 text-left text-[11px] font-medium text-[#667085] min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-sm">
                  Created
                </th>
                <th className="px-2.5 py-2 text-left text-[11px] font-medium text-[#667085] min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-sm">
                  Updated
                </th>
                <th className="px-2.5 py-2 text-right text-[11px] font-medium text-[#667085] min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-sm">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0]">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-[#FCFCFD]">
                  <td className="px-2.5 py-2 min-[700px]:px-4 min-[700px]:py-3">
                    <div className="max-w-[140px] font-medium text-[#101828] min-[700px]:max-w-none">
                      {template.name}
                    </div>
                    {template.description ? (
                      <div className="mt-0.5 line-clamp-1 max-w-[140px] text-[10px] text-[#667085] min-[700px]:max-w-none min-[700px]:text-xs">
                        {template.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-[#344054] min-[700px]:px-4 min-[700px]:py-3">
                    {RECRUITER_TEMPLATE_CATEGORY_LABELS[template.category]}
                  </td>
                  <td className="px-2.5 py-2 min-[700px]:px-4 min-[700px]:py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset min-[700px]:px-2.5 min-[700px]:text-xs ${statusBadgeClass(template.status)}`}
                    >
                      {template.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-[#667085] min-[700px]:px-4 min-[700px]:py-3">
                    {formatDate(template.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-[#667085] min-[700px]:px-4 min-[700px]:py-3">
                    {formatDate(template.updated_at)}
                  </td>
                  <td className="px-2.5 py-2 min-[700px]:px-4 min-[700px]:py-3">
                    <TemplateActions
                      template={template}
                      busy={actionId === template.id}
                      onAction={(action) => void runAction(template.id, action)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
