"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import AdminFaqBrowser from "@/app/admin_recruiter/components/AdminFaqBrowser";
import { FaqEditorModal } from "@/app/admin_recruiter/tickets/knowledgebase/FaqEditorModal";
import { useAdminHeaderData } from "@/lib/admin/hooks/use-admin-header-data";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  BRAND_FONT_BODY_STYLE,
  BRAND_FONT_HEADING_STYLE,
} from "@/lib/tenant/branding-typography-styles";
import type { FaqListItem } from "@/lib/faqs/types";

const FAQ_SEARCH_INPUT_ID = "help-support-faq-search";
const ACTION_ICON_GRAY = "#94A3B8";

function firstNameFromDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

function ChatSendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      <path
        d="M1.33998 14L15.3333 8L1.33998 2L1.33331 6.66667L11.3333 8L1.33331 9.33333L1.33998 14Z"
        fill={ACTION_ICON_GRAY}
      />
    </svg>
  );
}

function HelpSupportActionRow({
  label,
  icon,
  onClick,
  href,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "flex h-14 w-full items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-[14px] text-left text-base font-semibold leading-6 text-[color:var(--brand-secondary,#012352)] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#FAFBFC]";

  if (href) {
    return (
      <Link href={href} className={className}>
        <span className="min-w-0 flex-1">{label}</span>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <span className="min-w-0 flex-1">{label}</span>
      {icon}
    </button>
  );
}

export default function HelpSupportClient() {
  const branding = useTenantBranding();
  const secondaryColor = branding.secondaryHex || "#012352";
  const { displayName } = useAdminHeaderData();
  const greetingName = useMemo(() => firstNameFromDisplayName(displayName), [displayName]);
  const [faqSearchQuery, setFaqSearchQuery] = useState("");
  const [faqSearchVisible, setFaqSearchVisible] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingFaq, setEditingFaq] = useState<FaqListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingFaqId, setDeletingFaqId] = useState<string | null>(null);
  const [faqRefreshKey, setFaqRefreshKey] = useState(0);

  function focusFaqSearch() {
    setFaqSearchVisible(true);
    const section = document.getElementById("help-faq-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById(FAQ_SEARCH_INPUT_ID)?.focus();
    }, 300);
  }

  function openCreate() {
    setEditorMode("create");
    setEditingFaq(null);
    setEditorOpen(true);
  }

  function openEdit(faq: FaqListItem) {
    if (!faq.tenant_id) {
      toast.error("Platform FAQs are read-only.");
      return;
    }
    setEditorMode("edit");
    setEditingFaq(faq);
    setEditorOpen(true);
  }

  async function handleSubmitFaq(input: {
    category: string;
    question: string;
    answer: string;
    sortOrder: number;
    isPublished: boolean;
  }) {
    setSubmitting(true);
    try {
      if (editorMode === "edit") {
        if (!editingFaq) return;
        const res = await fetch(`/api/admin/faqs/${encodeURIComponent(editingFaq.id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not save FAQ.");
        toast.success("FAQ updated");
      } else {
        const res = await fetch("/api/admin/faqs", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not create FAQ.");
        toast.success("FAQ created");
      }
      setEditorOpen(false);
      setEditingFaq(null);
      setFaqRefreshKey((current) => current + 1);
      document.getElementById("help-faq-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : editorMode === "edit"
            ? "Could not save FAQ."
            : "Could not create FAQ."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteFaq(faq: FaqListItem) {
    if (!faq.tenant_id) {
      toast.error("Platform FAQs cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(`Delete FAQ “${faq.question}”?`);
    if (!confirmed) return;
    setDeletingFaqId(faq.id);
    try {
      const res = await fetch(`/api/admin/faqs/${encodeURIComponent(faq.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not delete FAQ.");
      toast.success("FAQ deleted");
      setFaqRefreshKey((current) => current + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete FAQ.");
    } finally {
      setDeletingFaqId(null);
    }
  }

  return (
    <div className="w-full min-w-0 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="admin-recruiter-content-width">
        <div className="mb-6 text-left">
          <h1
            className="m-0 text-2xl font-semibold leading-8 tracking-normal text-[color:var(--brand-secondary,#012352)]"
            style={BRAND_FONT_HEADING_STYLE}
          >
            Hi {greetingName}!
          </h1>
          <p
            className="m-0 mt-1 text-2xl font-semibold leading-8 tracking-normal text-[color:var(--brand-secondary,#012352)]"
            style={BRAND_FONT_HEADING_STYLE}
          >
            How can we help?
          </p>
        </div>

        <div className="flex w-full max-w-[330px] flex-col gap-3.5">
          <HelpSupportActionRow
            label="Send us message"
            href="/admin_recruiter/messages"
            icon={<ChatSendIcon />}
          />
          <HelpSupportActionRow
            label="Open Ticket"
            href="/admin_recruiter/tickets/support"
            icon={
              <ChevronRight
                className="h-5 w-5 shrink-0"
                style={{ color: ACTION_ICON_GRAY }}
                aria-hidden
              />
            }
          />

          <label className="flex h-14 w-full cursor-text items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-[14px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition focus-within:border-[color:var(--brand-primary,#BC8B41)]">
            <span className="sr-only">Search for help</span>
            <input
              type="search"
              value={faqSearchQuery}
              onChange={(event) => {
                setFaqSearchQuery(event.target.value);
                setFaqSearchVisible(true);
              }}
              onFocus={() => setFaqSearchVisible(true)}
              placeholder="Search for help"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold leading-6 text-[color:var(--brand-secondary,#012352)] outline-none placeholder:font-semibold placeholder:text-[color:var(--brand-secondary,#012352)]"
              style={BRAND_FONT_BODY_STYLE}
              aria-controls="help-faq-section"
            />
            <button
              type="button"
              onClick={focusFaqSearch}
              className="inline-flex shrink-0 text-[#94A3B8] transition hover:text-[color:var(--brand-secondary,#012352)]"
              aria-label="Focus FAQ search"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
          </label>
        </div>

        <div id="help-faq-section" className="mt-8 w-full">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#6B7280]" style={BRAND_FONT_BODY_STYLE}>
              Looking to add or edit articles?
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:brightness-95"
              style={{ backgroundColor: secondaryColor }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add FAQ
            </button>
          </div>
          <AdminFaqBrowser
            variant="cards"
            contentAlign="start"
            refreshKey={faqRefreshKey}
            fetchUrl="/api/admin/faqs?manage=1"
            loadingLabel="Loading help articles..."
            emptyConfiguredMessage="No FAQ articles are available yet. Use Add FAQ to create the first one."
            searchInputId={FAQ_SEARCH_INPUT_ID}
            showSearchBar={faqSearchVisible}
            searchQuery={faqSearchQuery}
            onSearchQueryChange={setFaqSearchQuery}
            onEditFaq={openEdit}
            onDeleteFaq={(faq) => void handleDeleteFaq(faq)}
            deletingFaqId={deletingFaqId}
          />
        </div>
      </div>

      <FaqEditorModal
        open={editorOpen}
        mode={editorMode}
        initial={editingFaq}
        submitting={submitting}
        onClose={() => {
          if (submitting) return;
          setEditorOpen(false);
          setEditingFaq(null);
        }}
        onSubmit={handleSubmitFaq}
      />
    </div>
  );
}
