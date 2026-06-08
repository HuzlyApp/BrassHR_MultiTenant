"use client";

import Image from "next/image";
import { useState } from "react";
import CreateTemplateModal, {
  type CreateTemplatePayload,
} from "@/app/admin_recruiter/components/CreateTemplateModal";
import TemplateCreateSuccessModal from "@/app/admin_recruiter/components/TemplateCreateSuccessModal";

const PAGE_BG = "#f8f8f8";
const CARD_BORDER = "#eaecf0";
const TEXT_PRIMARY = "#101828";
const TEXT_SECONDARY = "#667085";
const ICON_BOX_BG = "#f2f4f7";

type TemplateItem = {
  id: string;
  name: string;
};

const INITIAL_PRESETS: TemplateItem[] = [
  { id: "onboarding-1", name: "Onboarding 1.tpl" },
  { id: "onboarding-2", name: "Onboarding 2.tpl" },
];

const INITIAL_SAVED_TEMPLATES: TemplateItem[] = [
  { id: "post-offer", name: "Post-Offer.tpl" },
  { id: "final-offer", name: "Final Offer.tpl" },
];

function CreateTemplateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="6.75" stroke="white" strokeWidth="1.5" />
      <path d="M9 6.25V11.75M6.25 9H11.75" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TemplateCard({ item }: { item: TemplateItem }) {
  return (
    <article
      className="group relative flex min-h-[96px] items-center gap-4 rounded-xl border bg-white px-4 py-3 transition-colors"
      style={{ borderColor: CARD_BORDER }}
    >
      <div
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: ICON_BOX_BG }}
      >
        <Image src="/icons/template-icon.svg" alt="" width={24} height={24} className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="pr-[120px] text-[15px] font-semibold leading-6" style={{ color: TEXT_PRIMARY }}>
        {item.name}
      </h3>
      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label={`Template details for ${item.name}`}
          className="rounded-md p-0.5"
        >
          <Image
            src="/icons/template-icons/codicon_notebook-template.svg"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            aria-hidden
          />
        </button>
        <button type="button" aria-label={`Preview ${item.name}`} className="rounded-md p-0.5">
          <Image
            src="/icons/template-icons/eye.svg"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            aria-hidden
          />
        </button>
        <button type="button" aria-label={`Edit ${item.name}`} className="rounded-md p-0.5">
          <Image
            src="/icons/template-icons/pencil.svg"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            aria-hidden
          />
        </button>
        <button type="button" aria-label={`More actions for ${item.name}`} className="rounded-md p-0.5">
          <Image
            src="/icons/template-icons/dots-vertical.svg"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            aria-hidden
          />
        </button>
      </div>
      <span
        className="pointer-events-none absolute inset-0 rounded-xl border border-transparent transition-colors group-hover:border-[color:var(--brand-primary)]"
        aria-hidden
      />
    </article>
  );
}

export default function AdminRecruiterTemplatesPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdTemplateName, setCreatedTemplateName] = useState("");
  const [presets, setPresets] = useState<TemplateItem[]>(INITIAL_PRESETS);
  const [savedTemplates, setSavedTemplates] = useState<TemplateItem[]>(INITIAL_SAVED_TEMPLATES);

  const handleCreateTemplate = (payload: CreateTemplatePayload) => {
    const normalizedName = payload.name.endsWith(".tpl") ? payload.name : `${payload.name}.tpl`;
    const created: TemplateItem = {
      id: `template-${Date.now()}`,
      name: normalizedName,
    };

    if (payload.folder === "presets") {
      setPresets((prev) => [created, ...prev]);
    } else {
      setSavedTemplates((prev) => [created, ...prev]);
    }
    setCreatedTemplateName(normalizedName);
    setSuccessModalOpen(true);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="mx-auto w-full max-w-[1280px] px-5 py-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-[30px] font-semibold leading-[36px] text-[#000000]">
            My Templates
          </h1>
          <p className="mt-3 text-[16px] font-normal leading-6 text-[#374151]">
            Manage Workflow Templates
          </p>
        </header>

        <section className="rounded-xl border bg-white" style={{ borderColor: CARD_BORDER }}>
          <div className="flex items-center justify-end border-b px-4 py-3" style={{ borderColor: CARD_BORDER }}>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-[0.97]"
              style={{ background: "linear-gradient(180deg, #012352 0%, #000C1D 100%)" }}
            >
              <CreateTemplateIcon />
              Create new template
            </button>
          </div>

          <div className="space-y-8 p-4 sm:p-5">
            <div>
              <h2 className="mb-4 text-xl font-semibold leading-7" style={{ color: TEXT_PRIMARY }}>
                Presets
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {presets.map((template) => (
                  <TemplateCard key={template.id} item={template} />
                ))}
              </div>
            </div>

            <hr className="border-0 border-t" style={{ borderColor: CARD_BORDER }} />

            <div>
              <h2 className="mb-4 text-xl font-semibold leading-7" style={{ color: TEXT_PRIMARY }}>
                Saved Templates
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {savedTemplates.map((template) => (
                  <TemplateCard key={template.id} item={template} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <CreateTemplateModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateTemplate}
        />
        <TemplateCreateSuccessModal
          open={successModalOpen}
          templateName={createdTemplateName || "Template Pre-Offer"}
          onClose={() => setSuccessModalOpen(false)}
        />
      </div>
    </div>
  );
}
