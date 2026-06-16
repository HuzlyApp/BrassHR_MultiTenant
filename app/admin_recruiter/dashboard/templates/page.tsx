"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import CreateTemplateModal, {
  type CreateTemplatePayload,
} from "@/app/admin_recruiter/components/CreateTemplateModal";
import TemplateCreateSuccessModal from "@/app/admin_recruiter/components/TemplateCreateSuccessModal";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { staffAuthHeaders } from "@/lib/staff-auth-headers";
import { markPendingWorkflowPaste } from "@/lib/onboarding/workflow-template-pending-paste";

const PAGE_BG = "#f8f8f8";
const CARD_BORDER = "#eaecf0";
const TEXT_PRIMARY = "#101828";
const BUILDER_BASE = "/admin_recruiter/dashboard/onboarding-builder";
const BUILDER_QUERY_KEY = ["onboarding-builder", "effective-tenant"] as const;

type TemplateItem = {
  id: string;
  name: string;
  isPreset?: boolean;
};

function CreateTemplateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="6.75" stroke="white" strokeWidth="1.5" />
      <path d="M9 6.25V11.75M6.25 9H11.75" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TemplateActionButton({
  label,
  iconSrc,
  onClick,
  href,
  disabled = false,
}: {
  label: string;
  iconSrc: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className =
    "inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)] disabled:cursor-not-allowed disabled:opacity-40";

  const icon = (
    <BrandedSvgIcon src={iconSrc} className="h-4 w-4" color="var(--brand-primary)" />
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label} title={label}>
        {icon}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

function TemplateCard({
  item,
  canDelete,
  copying,
  onCopy,
  onView,
  onDelete,
}: {
  item: TemplateItem;
  canDelete: boolean;
  copying?: boolean;
  onCopy: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const editHref = `${BUILDER_BASE}?template=${item.id}`;
  const displayName = item.name.replace(/\.tpl$/i, "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <div
      className="group relative flex min-h-[96px] items-center gap-4 rounded-xl border bg-white px-4 py-3 transition-colors hover:border-[color:var(--brand-primary)]"
      style={{ borderColor: CARD_BORDER }}
    >
      <Link
        href={editHref}
        className="flex min-w-0 flex-1 items-center gap-4"
        aria-label={`Edit ${displayName}`}
      >
        <div
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, white)" }}
        >
          <BrandedSvgIcon
            src="/icons/template-icon.svg"
            className="h-6 w-6"
            color="var(--brand-primary)"
          />
        </div>
        <h3 className="truncate pr-28 text-[15px] font-semibold leading-6" style={{ color: TEXT_PRIMARY }}>
          {displayName}
        </h3>
      </Link>

      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <TemplateActionButton
          label="Copy to workflow"
          iconSrc="/icons/template-icons/codicon_notebook-template.svg"
          onClick={() => onCopy(item.id)}
          disabled={copying}
        />
        <TemplateActionButton
          label="View workflow"
          iconSrc="/icons/template-icons/eye.svg"
          onClick={() => onView(item.id)}
        />
        <TemplateActionButton
          label="Edit template"
          iconSrc="/icons/template-icons/pencil.svg"
          href={editHref}
        />
        {canDelete ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)]"
              aria-label="More options"
              title="More options"
            >
              <BrandedSvgIcon
                src="/icons/template-icons/dots-vertical.svg"
                className="h-4 w-4"
                color="var(--brand-primary)"
              />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border bg-white py-1 shadow-lg"
                style={{ borderColor: CARD_BORDER }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(item.id, displayName);
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminRecruiterTemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdTemplateName, setCreatedTemplateName] = useState("");
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(null);
  const [presets, setPresets] = useState<TemplateItem[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/workflow-templates", {
        headers: await staffAuthHeaders(),
      });
      const data = (await res.json()) as {
        presets?: TemplateItem[];
        savedTemplates?: TemplateItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load templates");
      setPresets(data.presets ?? []);
      setSavedTemplates(data.savedTemplates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
      setPresets([]);
      setSavedTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleCopyToWorkflow = useCallback(
    async (templateId: string) => {
      if (copyingId) return;
      setCopyingId(templateId);
      try {
        const res = await fetch(`/api/admin/workflow-templates/${templateId}/copy-to-workflow`, {
          method: "POST",
          headers: await staffAuthHeaders(),
        });
        const data = (await res.json()) as { error?: string; templateName?: string };
        if (!res.ok) throw new Error(data.error || "Failed to copy template");

        const name = data.templateName?.replace(/\.tpl$/i, "") ?? "Template";
        markPendingWorkflowPaste(templateId);
        void queryClient.invalidateQueries({ queryKey: BUILDER_QUERY_KEY });
        toast.success(`"${name}" copied. Open Builder and click Paste workflow.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to copy template");
      } finally {
        setCopyingId(null);
      }
    },
    [copyingId, queryClient]
  );

  const handleViewTemplate = useCallback(
    (templateId: string) => {
      router.push(`${BUILDER_BASE}?template=${templateId}&view=1`);
    },
    [router]
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string, displayName: string) => {
      const confirmed = window.confirm(`Delete "${displayName}"? This cannot be undone.`);
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/admin/workflow-templates/${templateId}`, {
          method: "DELETE",
          headers: await staffAuthHeaders(),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to delete template");
        toast.success("Template deleted");
        await loadTemplates();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete template");
      }
    },
    [loadTemplates]
  );

  const handleCreateTemplate = async (payload: CreateTemplatePayload) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/workflow-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await staffAuthHeaders()),
        },
        body: JSON.stringify({
          name: payload.name,
          folder: payload.folder,
          flowName: payload.name.replace(/\.tpl$/i, ""),
          builderDraft: { nodes: [], edges: [] },
        }),
      });
      const data = (await res.json()) as { template?: TemplateItem; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to create template");

      const created = data.template;
      if (!created?.id) throw new Error("Template was not created");

      setCreatedTemplateName(created.name);
      setCreatedTemplateId(created.id);
      setCreateModalOpen(false);
      setSuccessModalOpen(true);
      await loadTemplates();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create template");
    } finally {
      setCreating(false);
    }
  };

  const folderOptions = [
    { id: "presets" as const, label: "Presets", count: presets.length },
    { id: "saved-templates" as const, label: "Saved Templates", count: savedTemplates.length },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="mx-auto w-full max-w-[1280px] px-5 py-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-[30px] font-semibold leading-[36px] text-[#000000]">My Templates</h1>
          <p className="mt-3 text-[16px] font-normal leading-6 text-[#374151]">
            Manage Workflow Templates
          </p>
        </header>

        <section className="rounded-xl border bg-white" style={{ borderColor: CARD_BORDER }}>
          <div className="flex items-center justify-end border-b px-4 py-3" style={{ borderColor: CARD_BORDER }}>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateModalOpen(true);
              }}
              disabled={creating}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-[0.97] disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(90deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 70%, white) 100%)",
              }}
            >
              <CreateTemplateIcon />
              Create new template
            </button>
          </div>

          <div className="space-y-8 p-4 sm:p-5">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <CandidateDetailLoader label="Loading templates..." className="min-h-[280px] bg-transparent py-10" />
            ) : (
              <>
                <div>
                  <h2 className="mb-4 text-xl font-semibold leading-7" style={{ color: TEXT_PRIMARY }}>
                    Presets
                  </h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {presets.length === 0 ? (
                      <p className="text-sm text-[#667085]">No presets yet.</p>
                    ) : (
                      presets.map((template) => (
                        <TemplateCard
                          key={template.id}
                          item={template}
                          canDelete={false}
                          copying={copyingId === template.id}
                          onCopy={handleCopyToWorkflow}
                          onView={handleViewTemplate}
                          onDelete={handleDeleteTemplate}
                        />
                      ))
                    )}
                  </div>
                </div>

                <hr className="border-0 border-t" style={{ borderColor: CARD_BORDER }} />

                <div>
                  <h2 className="mb-4 text-xl font-semibold leading-7" style={{ color: TEXT_PRIMARY }}>
                    Saved Templates
                  </h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {savedTemplates.length === 0 ? (
                      <p className="text-sm text-[#667085]">
                        No saved templates yet. Save from the builder to see them here.
                      </p>
                    ) : (
                      savedTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          item={template}
                          canDelete
                          copying={copyingId === template.id}
                          onCopy={handleCopyToWorkflow}
                          onView={handleViewTemplate}
                          onDelete={handleDeleteTemplate}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <CreateTemplateModal
          open={createModalOpen}
          onClose={() => {
            if (creating) return;
            setCreateModalOpen(false);
            setCreateError(null);
          }}
          onCreate={handleCreateTemplate}
          folderOptions={folderOptions}
          creating={creating}
          error={createError}
        />
        <TemplateCreateSuccessModal
          open={successModalOpen}
          templateName={createdTemplateName || "Template"}
          templateId={createdTemplateId}
          onClose={() => setSuccessModalOpen(false)}
        />
      </div>
    </div>
  );
}
