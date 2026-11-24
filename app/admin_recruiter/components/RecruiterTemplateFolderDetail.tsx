"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, FileSignature, Plus } from "lucide-react";
import { recruiterTemplateFetch } from "@/app/admin_recruiter/components/recruiter-template-auth";
import MoveTemplateToFolderModal from "@/app/admin_recruiter/components/MoveTemplateToFolderModal";
import {
  NAVY,
  SectionHeading,
  TemplateCard,
  statusBadgeClass,
  type TemplateCardAction,
} from "@/app/admin_recruiter/components/RecruiterTemplateCards";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import type { RecruiterTemplateListItem } from "@/lib/recruiter-templates/types";
import {
  assignTemplateToFolder,
  countFolderStatuses,
  formatFolderStatusLine,
  readTemplateFolders,
  resolveFolderStorageScope,
  type RecruiterTemplateFolder,
} from "@/lib/recruiter-templates/template-folders-storage";

type ListResponse = {
  templates?: RecruiterTemplateListItem[];
  error?: string;
  code?: string;
  detail?: string;
};

type FolderTab = "active" | "archived";

export default function RecruiterTemplateFolderDetail({ folderId }: { folderId: string }) {
  const router = useRouter();
  const branding = useTenantBranding();
  const primary = branding.primaryHex || NAVY;
  const folderScope = resolveFolderStorageScope(branding.id, branding.slug);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<RecruiterTemplateListItem[]>([]);
  const [folder, setFolder] = useState<RecruiterTemplateFolder | null>(null);
  const [folders, setFolders] = useState<RecruiterTemplateFolder[]>([]);
  const [tab, setTab] = useState<FolderTab>("active");
  const [actionId, setActionId] = useState<string | null>(null);
  const [movingTemplate, setMovingTemplate] = useState<RecruiterTemplateListItem | null>(null);
  const [movingTemplateBusy, setMovingTemplateBusy] = useState(false);

  const loadFolder = useCallback(() => {
    const all = readTemplateFolders(folderScope);
    setFolders(all);
    setFolder(all.find((f) => f.id === folderId) ?? null);
  }, [folderId, folderScope]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recruiterTemplateFetch("/api/admin/recruiter-templates");
      const payload = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(payload.detail ?? payload.error ?? "Failed to load templates");
      setTemplates(payload.templates ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolder();
    void loadTemplates();
  }, [loadFolder, loadTemplates]);

  const folderTemplates = useMemo(() => {
    if (!folder) return [];
    const idSet = new Set(folder.templateIds);
    return templates.filter((t) => idSet.has(t.id));
  }, [folder, templates]);

  const counts = useMemo(
    () =>
      folder
        ? countFolderStatuses(folder, templates)
        : { active: 0, draft: 0, archived: 0 },
    [folder, templates]
  );

  const activeAndDraft = useMemo(
    () => folderTemplates.filter((t) => t.status === "active" || t.status === "draft"),
    [folderTemplates]
  );
  const activeOnly = useMemo(
    () => activeAndDraft.filter((t) => t.status === "active"),
    [activeAndDraft]
  );
  const draftOnly = useMemo(
    () => activeAndDraft.filter((t) => t.status === "draft"),
    [activeAndDraft]
  );
  const archivedOnly = useMemo(
    () => folderTemplates.filter((t) => t.status === "archived"),
    [folderTemplates]
  );

  const firstActiveId = activeOnly[0]?.id ?? null;

  const runAction = async (templateId: string, action: TemplateCardAction) => {
    if (action === "move") {
      const template = templates.find((row) => row.id === templateId) ?? null;
      if (template) setMovingTemplate(template);
      return;
    }

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
        void loadTemplates();
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
        void loadTemplates();
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

  const handleMoveTemplate = async (targetFolderId: string | null) => {
    if (!movingTemplate) return;
    setMovingTemplateBusy(true);
    try {
      assignTemplateToFolder(folderScope, movingTemplate.id, targetFolderId);
      loadFolder();
      const targetName =
        targetFolderId == null
          ? "Uncategorized"
          : folders.find((row) => row.id === targetFolderId)?.name ?? "folder";
      toast.success(`Moved ${movingTemplate.name} to ${targetName}`);
      setMovingTemplate(null);
    } finally {
      setMovingTemplateBusy(false);
    }
  };

  if (!loading && !folder) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin_recruiter/template-builder"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0F172A] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="rounded-xl border border-[#EAECF0] bg-white px-6 py-12 text-center">
          <h1 className="text-lg font-semibold text-[#101828]">Folder not found</h1>
          <p className="mt-2 text-sm text-[#667085]">
            This library may have been deleted or is stored in another browser profile.
          </p>
          <Link
            href="/admin_recruiter/template-builder"
            className="mt-5 inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: primary }}
          >
            Back to Templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin_recruiter/template-builder"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0F172A] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-[#101828] min-[700px]:text-2xl">
              {folder?.name ?? "Folder"}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusBadgeClass(
                counts.active > 0 ? "active" : counts.draft > 0 ? "draft" : "archived"
              )}`}
            >
              {counts.active > 0 ? "Active" : counts.draft > 0 ? "Draft" : "Archived"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#667085]">{formatFolderStatusLine(counts)}</p>
        </div>
        <Link
          href={`/admin_recruiter/template-builder/new?folder=${encodeURIComponent(folderId)}`}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white hover:brightness-95"
          style={{ backgroundColor: primary }}
        >
          <Plus className="h-4 w-4" />
          New Template
        </Link>
      </div>

      <div className="flex gap-5 border-b border-[#E5E7EB]">
        {(
          [
            ["active", "Active"],
            ["archived", "Archived"],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 pb-2.5 text-sm font-medium ${
                active
                  ? "border-[color:var(--brand-primary,#012352)] text-[#111827]"
                  : "border-transparent text-[#6B7280]"
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs text-[#98A2B3]">
                {key === "active" ? counts.active + counts.draft : counts.archived}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#EAECF0] bg-white px-4 py-12 text-center text-sm text-[#667085]">
          Loading…
        </div>
      ) : tab === "archived" ? (
        archivedOnly.length === 0 ? (
          <EmptyState message="No archived templates in this folder." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {archivedOnly.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                busy={actionId === template.id}
                onAction={(action) => void runAction(template.id, action)}
              />
            ))}
          </div>
        )
      ) : activeAndDraft.length === 0 ? (
        <EmptyState
          message="No active or draft templates in this folder."
          actionHref={`/admin_recruiter/template-builder/new?folder=${encodeURIComponent(folderId)}`}
          actionLabel="New Template"
          primary={primary}
        />
      ) : (
        <div className="space-y-8">
          {activeOnly.length > 0 ? (
            <section>
              <SectionHeading title="Active" count={activeOnly.length} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeOnly.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    busy={actionId === template.id}
                    showDefaultBadge={template.id === firstActiveId}
                    onAction={(action) => void runAction(template.id, action)}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {draftOnly.length > 0 ? (
            <section>
              <SectionHeading title="Draft" count={draftOnly.length} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {draftOnly.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    busy={actionId === template.id}
                    onAction={(action) => void runAction(template.id, action)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <MoveTemplateToFolderModal
        open={movingTemplate !== null}
        templateName={movingTemplate?.name ?? ""}
        folders={folders}
        currentFolderId={folderId}
        saving={movingTemplateBusy}
        onClose={() => {
          if (movingTemplateBusy) return;
          setMovingTemplate(null);
        }}
        onMove={handleMoveTemplate}
      />
    </div>
  );
}

function EmptyState({
  message,
  actionHref,
  actionLabel,
  primary,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
  primary?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F2F4F7]">
        <FileSignature className="h-5 w-5 text-[#667085]" />
      </div>
      <p className="mt-3 text-sm text-[#667085]">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: primary || NAVY }}
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
