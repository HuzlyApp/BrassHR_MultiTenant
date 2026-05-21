"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BRAAS_PRIMARY } from "@/lib/tenant/tenant-branding";

const GOLD = BRAAS_PRIMARY;
const PAGE_BG = "#f8f8f8";
const CARD_BORDER = "#eaecf0";
const TEXT_PRIMARY = "#101828";
const TEXT_SECONDARY = "#667085";
const TEXT_MUTED = "#98a2b3";
const ICON_BOX_BG = "#f2f4f7";

type FlowLibrary = {
  id: string;
  title: string;
  published: number;
  unpublished: number;
  active?: boolean;
};

const UNCATEGORIZED: FlowLibrary = {
  id: "uncategorized",
  title: "Uncategorized Flows",
  published: 14,
  unpublished: 2,
};

const LIBRARIES: FlowLibrary[] = [
  {
    id: "onboarding",
    title: "Onboarding Flows",
    published: 12,
    unpublished: 2,
    active: true,
  },
  {
    id: "marketing",
    title: "Marketing Flows",
    published: 8,
    unpublished: 1,
  },
];

function FolderIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 8.5C4 7.119 5.119 6 6.5 6H11.2L13 8H21.5C22.881 8 24 9.119 24 10.5V20.5C24 21.881 22.881 23 21.5 23H6.5C5.119 23 4 21.881 4 20.5V8.5Z"
        stroke={GOLD}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddLibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3.5 6.5C3.5 5.395 4.395 4.5 5.5 4.5H8.1L9.25 6H14.5C15.605 6 16.5 6.895 16.5 8V14.5C16.5 15.605 15.605 16.5 14.5 16.5H5.5C4.395 16.5 3.5 15.605 3.5 14.5V6.5Z"
        stroke={TEXT_PRIMARY}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 8.5V12.5M8 10.5H12" stroke={TEXT_PRIMARY} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CreateFlowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.25" stroke="white" strokeWidth="1.5" />
      <path d="M10 7.25V12.75M7.25 10H12.75" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M7 5L11 9L7 13"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 6L8 10L12 6"
        stroke={TEXT_SECONDARY}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type CreateFolderModalProps = {
  open: boolean;
  onClose: () => void;
};

function CreateFolderModal({ open, onClose }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const [selectedFlows, setSelectedFlows] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleCreate = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-folder-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[480px] rounded-2xl bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] transition hover:brightness-110"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: ICON_BOX_BG }}
          >
            <FolderIcon className="h-6 w-6" />
          </div>
          <h2
            id="create-folder-title"
            className="text-xl font-semibold leading-7"
            style={{ color: TEXT_PRIMARY }}
          >
            Create folder
          </h2>
        </div>

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <div>
            <label
              htmlFor="folder-name"
              className="mb-1.5 block text-sm font-medium leading-5"
              style={{ color: TEXT_PRIMARY }}
            >
              Folder Name
            </label>
            <input
              id="folder-name"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Remote Onboarding"
              className="h-11 w-full rounded-lg border px-3.5 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25"
              style={{
                borderColor: CARD_BORDER,
                color: TEXT_PRIMARY,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="add-flows"
              className="mb-1.5 block text-sm font-medium leading-5"
              style={{ color: TEXT_PRIMARY }}
            >
              Add flows to library
            </label>
            <div className="relative">
              <select
                id="add-flows"
                value={selectedFlows}
                onChange={(e) => setSelectedFlows(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border bg-white px-3.5 pr-10 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25"
                style={{
                  borderColor: CARD_BORDER,
                  color: selectedFlows ? TEXT_PRIMARY : TEXT_MUTED,
                }}
              >
                <option value="">Select flows</option>
                <option value="onboarding">Onboarding Flows</option>
                <option value="marketing">Marketing Flows</option>
                <option value="uncategorized">Uncategorized Flows</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <ChevronDownIcon />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPrivate}
              aria-label="Set as private"
              onClick={() => setIsPrivate((v) => !v)}
              className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
              style={{ backgroundColor: isPrivate ? "#2e90fa" : "#d0d5dd" }}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                  isPrivate ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-sm font-medium leading-5" style={{ color: TEXT_PRIMARY }}>
              Set as private
            </span>
          </div>

          <button
            type="submit"
            className="mt-2 h-11 w-full rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
            style={{ background: "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)" }}
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}

function FlowLibraryCard({ library }: { library: FlowLibrary }) {
  return (
    <article
      className="flex min-h-[100px] items-center gap-5 rounded-xl border bg-white px-6 py-5"
      style={{
        borderColor: library.active ? GOLD : CARD_BORDER,
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
      }}
    >
      <div
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: ICON_BOX_BG }}
      >
        <FolderIcon />
      </div>

      <div className="min-w-0 flex-1">
        <h2
          className="text-[15px] font-semibold leading-6"
          style={{ color: TEXT_PRIMARY }}
        >
          {library.title}
        </h2>
        <p className="mt-0.5 text-sm leading-5" style={{ color: TEXT_SECONDARY }}>
          {library.published} Published <span className="text-[#d0d5dd]">•</span>{" "}
          {library.unpublished} Unpublished
        </p>
      </div>

      {library.active ? (
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:brightness-95"
          style={{ backgroundColor: GOLD }}
          aria-label={`Open ${library.title}`}
        >
          <ChevronRightIcon />
        </button>
      ) : null}
    </article>
  );
}

export default function WorkflowLibraryPage() {
  const [createFlowModalOpen, setCreateFlowModalOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 sm:py-10">
        {/* Breadcrumb */}
        <nav
          className="mb-4 text-[13px] leading-5"
          style={{ color: TEXT_MUTED }}
          aria-label="Breadcrumb"
        >
          <Link href="/braas-hr/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <span className="mx-1.5">&gt;</span>
          <span style={{ color: TEXT_SECONDARY }}>Workflow Library</span>
        </nav>

        {/* Title row + actions */}
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1
              className="text-[32px] font-semibold leading-[40px] tracking-[-0.02em] sm:text-[36px] sm:leading-[44px]"
              style={{ color: TEXT_PRIMARY }}
            >
              Workflow Library
            </h1>
            <p className="mt-1 text-sm leading-5" style={{ color: TEXT_SECONDARY }}>
              Manage workflows library
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold transition hover:bg-[#fafafa]"
              style={{ borderColor: "#344054", color: TEXT_PRIMARY }}
            >
              <AddLibraryIcon />
              Add library
            </button>
            <button
              type="button"
              onClick={() => setCreateFlowModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-[0.97]"
              style={{ background: "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)" }}
            >
              <CreateFlowIcon />
              Create new flow
            </button>
          </div>
        </header>

        {/* Cards */}
        <section aria-label="Workflow libraries">
          {/* Figma: top card is left-aligned, ~half width — not full row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FlowLibraryCard library={UNCATEGORIZED} />
          </div>

          <hr
            className="my-8 border-0 border-t sm:my-10"
            style={{ borderColor: "#e4e7ec" }}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {LIBRARIES.map((lib) => (
              <FlowLibraryCard key={lib.id} library={lib} />
            ))}
          </div>
        </section>
      </div>

      <CreateFolderModal
        open={createFlowModalOpen}
        onClose={() => setCreateFlowModalOpen(false)}
      />
    </div>
  );
}
