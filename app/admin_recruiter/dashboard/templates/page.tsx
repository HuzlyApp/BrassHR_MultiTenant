"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import CreateTemplateModal, {
  type CreateTemplatePayload,
} from "@/app/admin_recruiter/components/CreateTemplateModal";
import TemplateCreateSuccessModal from "@/app/admin_recruiter/components/TemplateCreateSuccessModal";
import { supabaseBrowser } from "@/lib/supabase-browser";

const PAGE_BG = "#f8f8f8";
const CARD_BORDER = "#eaecf0";
const TEXT_PRIMARY = "#101828";

type TemplateItem = {
  id: string;
  name: string;
};

async function staffAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function CreateTemplateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="6.75" stroke="white" strokeWidth="1.5" />
      <path d="M9 6.25V11.75M6.25 9H11.75" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TemplateCard({ item }: { item: TemplateItem }) {
  const editHref = `/admin_recruiter/dashboard/onboarding-builder?template=${item.id}`;
  const displayName = item.name.replace(/\.tpl$/i, "");

  return (
    <Link
      href={editHref}
      className="group relative flex min-h-[96px] items-center gap-4 rounded-xl border bg-white px-4 py-3 transition-colors hover:border-[color:var(--brand-primary)]"
      style={{ borderColor: CARD_BORDER }}
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
      <h3 className="pr-12 text-[15px] font-semibold leading-6" style={{ color: TEXT_PRIMARY }}>
        {displayName}
      </h3>
      <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100">
        <BrandedSvgIcon
          src="/icons/template-icons/pencil.svg"
          className="h-4 w-4"
          color="var(--brand-primary)"
        />
      </span>
    </Link>
  );
}

export default function AdminRecruiterTemplatesPage() {
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
              <p className="py-8 text-center text-sm text-[#667085]">Loading templates…</p>
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
                      presets.map((template) => <TemplateCard key={template.id} item={template} />)
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
                        <TemplateCard key={template.id} item={template} />
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
