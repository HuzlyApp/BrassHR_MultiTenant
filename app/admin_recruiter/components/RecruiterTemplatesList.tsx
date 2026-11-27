"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, FileSignature, FolderPlus, Plus, Search } from "lucide-react";
import { recruiterTemplateFetch } from "@/app/admin_recruiter/components/recruiter-template-auth";
import CreateFolderModal from "@/app/admin_recruiter/components/CreateFolderModal";
import FolderCreateSuccessModal from "@/app/admin_recruiter/components/FolderCreateSuccessModal";
import MoveTemplateToFolderModal from "@/app/admin_recruiter/components/MoveTemplateToFolderModal";
import {
  FolderCard,
  NAVY,
  SectionHeading,
  TemplateCard,
  type TemplateCardAction,
} from "@/app/admin_recruiter/components/RecruiterTemplateCards";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import type { RecruiterTemplateListItem } from "@/lib/recruiter-templates/types";
import {
  assignTemplateToFolder,
  countFolderStatuses,
  createTemplateFolder,
  deleteTemplateFolder,
  findFolderForTemplate,
  getAssignedTemplateIds,
  readTemplateFolders,
  resolveFolderStorageScope,
  updateTemplateFolder,
  type RecruiterTemplateFolder,
} from "@/lib/recruiter-templates/template-folders-storage";

type ListResponse = {
  templates?: RecruiterTemplateListItem[];
  error?: string;
  code?: string;
  detail?: string;
};

type DocumentTemplateTab = "all" | "esign" | "normal";

export default function RecruiterTemplatesList() {
  const router = useRouter();
  const branding = useTenantBranding();
  const primary = branding.primaryHex || NAVY;
  const folderScope = resolveFolderStorageScope(branding.id, branding.slug);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<RecruiterTemplateListItem[]>([]);
  const [folders, setFolders] = useState<RecruiterTemplateFolder[]>([]);
  const [tenantMissing, setTenantMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [documentTab, setDocumentTab] = useState<DocumentTemplateTab>("all");
  const [actionId, setActionId] = useState<string | null>(null);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [successFolder, setSuccessFolder] = useState<{ name: string; id: string } | null>(null);
  const [movingTemplate, setMovingTemplate] = useState<RecruiterTemplateListItem | null>(null);
  const [movingTemplateBusy, setMovingTemplateBusy] = useState(false);

  const refreshFolders = useCallback(() => {
    setFolders(readTemplateFolders(folderScope));
  }, [folderScope]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recruiterTemplateFetch("/api/admin/recruiter-templates");
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  const filteredByTab = useMemo(() => {
    return templates.filter((template) => {
      if (documentTab === "esign") return Boolean(template.firma_template_id);
      if (documentTab === "normal") return !template.firma_template_id;
      return true;
    });
  }, [documentTab, templates]);

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredByTab;
    return filteredByTab.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [filteredByTab, search]);

  const assignedIds = useMemo(() => getAssignedTemplateIds(folders), [folders]);

  const uncategorized = useMemo(
    () => searchFiltered.filter((t) => !assignedIds.has(t.id)),
    [assignedIds, searchFiltered]
  );

  const firstActiveId = useMemo(
    () => searchFiltered.find((t) => t.status === "active")?.id ?? null,
    [searchFiltered]
  );

  const visibleFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, search]);

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

  const handleCreateFolder = async (payload: { name: string; templateIds: string[] }) => {
    setCreatingFolder(true);
    setFolderError(null);
    try {
      const folder = createTemplateFolder(folderScope, payload.name, payload.templateIds);
      refreshFolders();
      setCreateFolderOpen(false);
      setSuccessFolder({ name: folder.name, id: folder.id });
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "Could not create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleRenameFolder = (folder: RecruiterTemplateFolder) => {
    const next = window.prompt("Rename folder", folder.name);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === folder.name) return;
    updateTemplateFolder(folderScope, folder.id, { name: trimmed });
    refreshFolders();
    toast.success("Folder renamed");
  };

  const handleDeleteFolder = (folder: RecruiterTemplateFolder) => {
    if (!window.confirm(`Delete folder “${folder.name}”? Templates stay uncategorized.`)) return;
    deleteTemplateFolder(folderScope, folder.id);
    refreshFolders();
    toast.success("Folder deleted");
  };

  const handleMoveTemplate = async (folderId: string | null) => {
    if (!movingTemplate) return;
    setMovingTemplateBusy(true);
    try {
      assignTemplateToFolder(folderScope, movingTemplate.id, folderId);
      refreshFolders();
      const targetName =
        folderId == null
          ? "Uncategorized"
          : folders.find((folder) => folder.id === folderId)?.name ?? "folder";
      toast.success(`Moved ${movingTemplate.name} to ${targetName}`);
      setMovingTemplate(null);
    } finally {
      setMovingTemplateBusy(false);
    }
  };

  const movingCurrentFolderId = movingTemplate
    ? findFolderForTemplate(folders, movingTemplate.id)?.id ?? null
    : null;

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden min-[700px]:space-y-6 max-[449px]:space-y-4">
      <Link
        href="/admin_recruiter/settings/templates"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>

      <div className="flex min-w-0 flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7 text-[#101828] min-[700px]:text-2xl max-[449px]:text-lg">
            Templates
          </h1>
          <p className="mt-1 text-sm leading-5 text-[#667085] max-[449px]:text-xs">
            Create and organize recruiting document templates into libraries.
          </p>
        </div>
        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 min-[480px]:flex-row min-[640px]:w-auto">
          <button
            type="button"
            onClick={() => {
              setFolderError(null);
              setCreateFolderOpen(true);
            }}
            className="inline-flex h-10 min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold leading-none text-[#344054] hover:bg-[#F9FAFB] min-[640px]:w-auto"
          >
            <FolderPlus className="h-4 w-4 shrink-0" />
            Create a folder
          </button>
          <Link
            href="/admin_recruiter/template-builder/new"
            className="inline-flex h-10 min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold leading-none text-white hover:brightness-95 min-[640px]:w-auto"
            style={{ backgroundColor: primary }}
          >
            <Plus className="h-4 w-4 shrink-0" />
            New Template
          </Link>
        </div>
      </div>

      {tenantMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Tenant required</p>
          <p className="mt-1">
            Select a tenant using the tenant switcher in the header before managing templates.
          </p>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 min-w-0 overflow-x-auto border-b border-[#E5E7EB] px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full gap-4 max-[449px]:gap-3 sm:gap-5">
            {(
              [
                ["all", "All"],
                ["esign", "Esign Documents"],
                ["normal", "Normal Documents"],
              ] as const
            ).map(([key, label]) => {
              const active = documentTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDocumentTab(key)}
                  className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-medium whitespace-nowrap max-[449px]:text-xs ${
                    active
                      ? "border-[color:var(--brand-primary,#012352)] text-[#111827]"
                      : "border-transparent text-[#6B7280]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex h-10 w-full min-w-0 max-w-md items-center rounded-lg border border-[#D0D5DD] bg-white px-3 focus-within:border-[color:var(--brand-primary)] focus-within:ring-1 focus-within:ring-[color:var(--brand-primary)] max-[449px]:h-9 sm:ml-auto">
          <Search className="mr-2 h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates or folders…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] max-[449px]:text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#EAECF0] bg-white px-4 py-12 text-center text-sm text-[#667085]">
          Loading templates…
        </div>
      ) : templates.length === 0 && folders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F4F7]">
            <FileSignature className="h-6 w-6 text-[#667085]" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#101828]">No templates yet</h2>
          <p className="mt-2 text-sm text-[#667085]">
            Create your first recruiting template or organize work with a folder.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCreateFolderOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
            >
              <FolderPlus className="h-4 w-4" />
              Create a folder
            </button>
            <Link
              href="/admin_recruiter/template-builder/new"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: primary }}
            >
              <Plus className="h-4 w-4" />
              New Template
            </Link>
          </div>
        </div>
      ) : (
        <div className="min-w-0 space-y-8 max-[449px]:space-y-6">
          <section className="min-w-0">
            <SectionHeading title="Uncategorized" count={uncategorized.length} />
            {uncategorized.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 py-8 text-center text-sm text-[#667085]">
                {searchFiltered.length === 0
                  ? "No templates match this filter."
                  : "All matching templates are in a library folder."}
              </p>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {uncategorized.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    busy={actionId === template.id}
                    showDefaultBadge={template.id === firstActiveId}
                    onAction={(action) => void runAction(template.id, action)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0">
            <SectionHeading title="Libraries" count={visibleFolders.length} />
            {visibleFolders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 py-8 text-center">
                <p className="text-sm text-[#667085]">
                  No folders yet. Create a library to group templates.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateFolderOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-primary,#012352)] hover:underline"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create a folder
                </button>
              </div>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    counts={countFolderStatuses(folder, templates)}
                    href={`/admin_recruiter/template-builder/folder/${folder.id}`}
                    onRename={() => handleRenameFolder(folder)}
                    onDelete={() => handleDeleteFolder(folder)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <CreateFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
        templates={templates.map((t) => ({ id: t.id, name: t.name, status: t.status }))}
        creating={creatingFolder}
        error={folderError}
      />

      <MoveTemplateToFolderModal
        open={movingTemplate !== null}
        templateName={movingTemplate?.name ?? ""}
        folders={folders}
        currentFolderId={movingCurrentFolderId}
        saving={movingTemplateBusy}
        onClose={() => {
          if (movingTemplateBusy) return;
          setMovingTemplate(null);
        }}
        onMove={handleMoveTemplate}
      />

      <FolderCreateSuccessModal
        open={Boolean(successFolder)}
        folderName={successFolder?.name ?? ""}
        folderHref={
          successFolder
            ? `/admin_recruiter/template-builder/folder/${successFolder.id}`
            : "/admin_recruiter/template-builder"
        }
        onClose={() => setSuccessFolder(null)}
      />
    </div>
  );
}
