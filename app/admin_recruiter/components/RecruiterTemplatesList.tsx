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
  "w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]";

const selectClassName = `${fieldClassName} cursor-pointer appearance-none pr-10`;

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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between lg:items-center">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-7 text-[#101828] min-[700px]:text-xl">
            Template Builder
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-[#667085] min-[700px]:text-sm">
            Create and manage Firma.dev e-signature templates for recruiting workflows.
          </p>
        </div>
        <Link
          href="/admin_recruiter/template-builder/new"
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[color:var(--brand-primary)] to-[color:var(--brand-accent)] px-4 text-sm font-semibold text-white shadow-sm min-[480px]:w-auto"
        >
          <Plus className="h-4 w-4" />
          New template
        </Link>
      </div>

      {tenantMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Tenant required</p>
          <p className="mt-1">
            Select a tenant using the tenant switcher in the header before managing templates.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-[#EAECF0] bg-white p-4 min-[640px]:flex-row min-[640px]:flex-wrap min-[640px]:items-center lg:flex-nowrap">
        <div className="relative min-w-0 flex-1 min-[640px]:min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className={`${fieldClassName} py-2 pl-9 pr-3`}
          />
        </div>
        <div className="relative w-full min-[640px]:w-auto min-[640px]:min-w-[140px]">
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
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]"
            aria-hidden
          />
        </div>
        <div className="relative w-full min-[640px]:w-auto min-[640px]:min-w-[160px]">
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
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]"
            aria-hidden
          />
        </div>
      </div>

      {loading ? null : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F4F7]">
            <FileSignature className="h-6 w-6 text-[#667085]" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#101828]">No templates yet</h2>
          <p className="mt-2 text-sm text-[#667085]">Create your first recruiting template to get started.</p>
          <Link
            href="/admin_recruiter/template-builder/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[color:var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Create your first recruiting template
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#EAECF0] bg-white">
          <table className="min-w-[720px] w-full divide-y divide-[#EAECF0] text-sm">
            <thead className="bg-[#F9FAFB]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#667085]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[#667085]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[#667085]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#667085]">Created</th>
                <th className="px-4 py-3 text-left font-medium text-[#667085]">Updated</th>
                <th className="px-4 py-3 text-right font-medium text-[#667085]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0]">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-[#FCFCFD]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#101828]">{template.name}</div>
                    {template.description ? (
                      <div className="mt-0.5 line-clamp-1 text-xs text-[#667085]">
                        {template.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[#344054]">
                    {RECRUITER_TEMPLATE_CATEGORY_LABELS[template.category]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(template.status)}`}
                    >
                      {template.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{formatDate(template.created_at)}</td>
                  <td className="px-4 py-3 text-[#667085]">{formatDate(template.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin_recruiter/template-builder/${template.id}`}
                        className="rounded-md border border-[#D0D5DD] px-2.5 py-1 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/admin_recruiter/template-builder/${template.id}?preview=1`}
                        className="rounded-md border border-[#D0D5DD] px-2.5 py-1 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]"
                      >
                        Preview
                      </Link>
                      <button
                        type="button"
                        disabled={actionId === template.id}
                        onClick={() => void runAction(template.id, "duplicate")}
                        className="rounded-md border border-[#D0D5DD] px-2.5 py-1 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                      {template.status === "active" ? (
                        <button
                          type="button"
                          disabled={actionId === template.id}
                          onClick={() => void runAction(template.id, "signing-request")}
                          className="rounded-md border border-[#D0D5DD] px-2.5 py-1 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
                        >
                          Signing request
                        </button>
                      ) : null}
                      {template.status !== "archived" ? (
                        <button
                          type="button"
                          disabled={actionId === template.id}
                          onClick={() => void runAction(template.id, "archive")}
                          className="rounded-md border border-[#D0D5DD] px-2.5 py-1 text-xs font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-50"
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionId === template.id}
                          onClick={() => void runAction(template.id, "delete")}
                          className="rounded-md border border-[#FDA29B] px-2.5 py-1 text-xs font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
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
