"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import toast from "react-hot-toast";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { useOnboardingLibraries } from "@/lib/onboarding/hooks/use-onboarding-libraries";
import { useOnboardingFlows } from "@/lib/onboarding/hooks/use-onboarding-flows";
import { BRAND_SECONDARY_BG, GOLD_GRADIENT, NAVY_GRADIENT } from "../constants";

const BRAND_PRIMARY = "var(--brand-primary)";
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
  slug: string;
  isUncategorized?: boolean;
};

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
        stroke={BRAND_PRIMARY}
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
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="block shrink-0"
    >
      <path d="M3.5 3.5L10.5 10.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.5 3.5L3.5 10.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
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

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 10L8 6L12 10"
        stroke={TEXT_SECONDARY}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke={TEXT_MUTED} strokeWidth="1.5" />
      <path
        d="M10 10L13 13"
        stroke={TEXT_MUTED}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlowNodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="5.5" width="4" height="4" rx="1" stroke={TEXT_SECONDARY} strokeWidth="1.25" />
      <rect x="10.5" y="1.5" width="4" height="4" rx="1" stroke={TEXT_SECONDARY} strokeWidth="1.25" />
      <rect x="10.5" y="10.5" width="4" height="4" rx="1" stroke={TEXT_SECONDARY} strokeWidth="1.25" />
      <path
        d="M5.5 7.5H8M8 7.5V4.5M8 7.5V11.5"
        stroke={TEXT_SECONDARY}
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5L4.25 7.25L8 3.25"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type FlowOption = {
  id: string;
  label: string;
};

type FlowMultiSelectProps = {
  id: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  options: FlowOption[];
};

function FlowMultiSelect({ id, selectedIds, onChange, options }: FlowMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filteredFlows = options.filter((flow) =>
    flow.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const toggleFlow = (flowId: string) => {
    if (selectedIds.includes(flowId)) {
      onChange(selectedIds.filter((id) => id !== flowId));
    } else {
      onChange([...selectedIds, flowId]);
    }
  };

  const addedCount = selectedIds.length;

  return (
    <div ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3.5 text-left text-sm outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] ${
            open ? "rounded-b-none border-b-0" : ""
          }`}
          style={{
            borderColor: CARD_BORDER,
            color: TEXT_MUTED,
          }}
        >
          <span>Select flows</span>
          <span className="shrink-0">{open ? <ChevronUpIcon /> : <ChevronDownIcon />}</span>
        </button>

        {open ? (
          <div
            className="absolute left-0 right-0 top-full z-10 overflow-hidden rounded-b-lg border border-t-0 bg-white shadow-sm"
            style={{ borderColor: CARD_BORDER }}
          >
            <div className="border-b px-3 py-2.5" style={{ borderColor: CARD_BORDER }}>
              <div className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search flow"
                  className="h-9 w-full rounded-md border bg-white py-2 pl-3 pr-9 text-sm outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
                  style={{
                    borderColor: CARD_BORDER,
                    color: TEXT_PRIMARY,
                  }}
                  aria-label="Search flow"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  <SearchIcon />
                </span>
              </div>
            </div>

            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              aria-label="Flows"
              className="max-h-[180px] overflow-y-auto py-1"
            >
              {filteredFlows.length === 0 ? (
                <li className="px-3.5 py-3 text-sm" style={{ color: TEXT_MUTED }}>
                  No flows found
                </li>
              ) : (
                filteredFlows.map((flow) => {
                  const checked = selectedIds.includes(flow.id);
                  return (
                    <li key={flow.id} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        onClick={() => toggleFlow(flow.id)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition hover:bg-[#f9fafb]"
                        style={{
                          backgroundColor: checked ? "#f2f4f7" : undefined,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        <FlowNodeIcon />
                        <span className="min-w-0 flex-1 truncate">{flow.label}</span>
                        <span
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition ${
                            checked ? "" : "border-[#d0d5dd] bg-white"
                          }`}
                          style={
                            checked
                              ? {
                                  borderColor: BRAND_SECONDARY_BG,
                                  backgroundColor: BRAND_SECONDARY_BG,
                                }
                              : undefined
                          }
                          aria-hidden
                        >
                          {checked ? <CheckIcon /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {addedCount > 0 ? (
        <p className="mt-1.5 text-right text-xs leading-[18px]" style={{ color: TEXT_MUTED }}>
          {addedCount} added
        </p>
      ) : null}
    </div>
  );
}

function SuccessCheckIcon() {
  return (
    <svg
      width="32"
      height="27"
      viewBox="0 0 32 27"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M26.36 3.77333L28.2267 5.64L11.24 22.6267L3.77333 15.16L5.64 13.2933L11.24 18.8933L26.36 3.77333ZM26.36 0L11.24 15.12L5.64 9.52L0 15.16L11.24 26.4L32 5.64L26.36 0Z"
        fill="white"
      />
    </svg>
  );
}

type FolderCreatedSuccessModalProps = {
  open: boolean;
  folderName: string;
  folderHref?: string;
  onClose: () => void;
};

function FolderCreatedSuccessModal({
  open,
  folderName,
  folderHref,
  onClose,
}: FolderCreatedSuccessModalProps) {
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

  if (!open) return null;

  const displayName = folderName.trim() || "New library";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-success-title"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-[400px] max-h-[min(92dvh,720px)] overflow-y-auto rounded-2xl bg-white px-5 pb-6 pt-8 shadow-xl max-[369px]:px-4 sm:px-10 sm:pb-8 sm:pt-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] transition hover:brightness-110 sm:right-5 sm:top-5"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND_PRIMARY }}
          >
            <SuccessCheckIcon />
          </div>

          <h2
            id="folder-success-title"
            className="text-xl font-semibold leading-7"
            style={{ color: TEXT_PRIMARY }}
          >
            Success!
          </h2>

          <p className="mt-2 text-sm leading-5" style={{ color: TEXT_SECONDARY }}>
            {displayName} has been created
          </p>

          {folderHref ? (
            <Link
              href={folderHref}
              onClick={onClose}
              className="mt-8 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
              style={{ background: GOLD_GRADIENT }}
            >
              Go to folder
            </Link>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="mt-8 h-11 w-full rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
              style={{ background: GOLD_GRADIENT }}
            >
              Go to folder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type CreateFolderModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (folderName: string) => void | Promise<void>;
  flowOptions: FlowOption[];
  saving?: boolean;
};

function CreateFolderModal({ open, onClose, onCreated, flowOptions, saving = false }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (open) return;
    setFolderName("");
    setSelectedFlowIds([]);
    setIsPrivate(true);
  }, [open]);

  const handleCreate = useCallback(async () => {
    const name = folderName.trim();
    if (!name) return;
    await onCreated(name);
    onClose();
  }, [folderName, onCreated, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-folder-title"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] transition hover:brightness-110 sm:right-5 sm:top-5"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="max-h-[min(92dvh,760px)] overflow-y-auto p-5 max-[369px]:p-4 sm:p-8">
        <div className="mb-5 flex items-center gap-2.5 pr-9 sm:mb-8 sm:gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
            style={{ backgroundColor: ICON_BOX_BG }}
          >
            <FolderIcon className="h-6 w-6" />
          </div>
          <h2
            id="create-folder-title"
            className="min-w-0 text-base font-semibold leading-6 sm:text-xl sm:leading-7"
            style={{ color: TEXT_PRIMARY }}
          >
            Create folder
          </h2>
        </div>

        <form
          className="flex flex-col gap-4 sm:gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <div className="min-w-0">
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
              placeholder="Enter folder name"
              required
              className="h-10 w-full min-w-0 rounded-lg border px-3 text-sm outline-none transition max-[369px]:h-9 max-[369px]:px-2.5 max-[369px]:text-[13px] focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] sm:h-11 sm:px-3.5"
              style={{
                borderColor: CARD_BORDER,
                color: TEXT_PRIMARY,
              }}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="add-flows"
              className="mb-1.5 block text-sm font-medium leading-5"
              style={{ color: TEXT_PRIMARY }}
            >
              Add flows to library
            </label>
            <FlowMultiSelect
              id="add-flows"
              selectedIds={selectedFlowIds}
              onChange={setSelectedFlowIds}
              options={flowOptions}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPrivate}
              aria-label="Set as private"
              onClick={() => setIsPrivate((v) => !v)}
              className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
              style={{ backgroundColor: isPrivate ? BRAND_SECONDARY_BG : "#d0d5dd" }}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                  isPrivate ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-sm font-medium leading-5" style={{ color: BRAND_SECONDARY_BG }}>
              Set as private
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || !folderName.trim()}
            className="mt-2 h-10 w-full rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97] disabled:opacity-60 max-[369px]:h-9 sm:h-11"
            style={{ background: GOLD_GRADIENT }}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

function libraryHref(library: FlowLibrary, dashboardBasePath: string): string {
  return `${dashboardBasePath}/onboarding-flows?library=${library.id}`;
}

function FlowLibraryCard({ library, dashboardBasePath }: { library: FlowLibrary; dashboardBasePath: string }) {
  const href = libraryHref(library, dashboardBasePath);

  const cardClassName =
    "flex min-h-[88px] items-center gap-3 rounded-xl border bg-white px-3 py-4 transition max-[369px]:gap-2.5 max-[369px]:px-2.5 sm:min-h-[100px] sm:gap-5 sm:px-6 sm:py-5";
  const cardStyle = {
    borderColor: library.slug === "onboarding" ? BRAND_PRIMARY : CARD_BORDER,
    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
  };

  const inner = (
    <>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg max-[369px]:h-9 max-[369px]:w-9 sm:h-[52px] sm:w-[52px]"
        style={{ backgroundColor: ICON_BOX_BG }}
      >
        <FolderIcon />
      </div>

      <div className="min-w-0 flex-1">
        <h2
          className="truncate text-[14px] font-semibold leading-5 sm:text-[15px] sm:leading-6"
          style={{ color: TEXT_PRIMARY }}
        >
          {library.title}
        </h2>
        <p className="mt-0.5 text-[12px] leading-4 sm:text-sm sm:leading-5" style={{ color: TEXT_SECONDARY }}>
          {library.published} Published <span className="text-[#d0d5dd]">•</span>{" "}
          {library.unpublished} Unpublished
        </p>
      </div>

      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9"
        style={{ background: NAVY_GRADIENT }}
        aria-hidden
      >
        <ChevronRightIcon />
      </span>
    </>
  );

  return (
    <Link
      href={href}
      className={`${cardClassName} hover:bg-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]`}
      style={cardStyle}
      aria-label={`Open ${library.title}`}
    >
      {inner}
    </Link>
  );
}

type WorkflowLibraryPageProps = {
  dashboardBasePath?: string;
  showTopTabs?: boolean;
  /** When true, breadcrumb/tabs render in AdminRecruiter layout shell instead. */
  embeddedInAdminShell?: boolean;
};

export function WorkflowLibraryPage({
  dashboardBasePath = "/braas-hr/dashboard",
  showTopTabs = false,
  embeddedInAdminShell = false,
}: WorkflowLibraryPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdFolderName, setCreatedFolderName] = useState("");
  const [createdLibraryId, setCreatedLibraryId] = useState<string | null>(null);

  const {
    tenantId,
    libraries,
    isLoading: librariesLoading,
    isFetching: librariesFetching,
    error: librariesError,
    createLibrary,
    isCreating: creatingLibrary,
  } = useOnboardingLibraries();

  const { flows: allFlows } = useOnboardingFlows();

  const flowOptions: FlowOption[] = allFlows.map((f) => ({ id: f.id, label: f.name }));

  const uncategorizedLibrary = libraries.find((l) => l.isUncategorized);
  const folderLibraries = libraries.filter((l) => !l.isUncategorized);

  const mapLibrary = (lib: (typeof libraries)[number]): FlowLibrary => ({
    id: lib.id,
    title: lib.name,
    published: lib.publishedCount,
    unpublished: lib.unpublishedCount,
    slug: lib.slug,
    isUncategorized: lib.isUncategorized,
  });

  useEffect(() => {
    if (pathname === "/braas-hr/dashboard/workflowlibrary") {
      router.replace("/admin_recruiter/dashboard/workflowlibrary");
    }
  }, [pathname, router]);

  if (pathname === "/braas-hr/dashboard/workflowlibrary") {
    return null;
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: PAGE_BG }}>
      <div
        className={`w-full min-w-0 ${
          embeddedInAdminShell
            ? "px-3 py-4 max-[369px]:px-2.5 sm:px-5 sm:py-6 lg:px-8"
            : "mx-auto max-w-[1280px] px-6 py-8 sm:px-10 sm:py-10"
        }`}
      >
        {/* Breadcrumb + top tabs */}
        {!embeddedInAdminShell && showTopTabs ? (
          <div className="mb-6 flex h-[62px] w-full items-center justify-between border border-[#E4E7EC] bg-white px-5 py-[14px]">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-[13px] leading-5 w-full">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[#667085]">
                <Link href={dashboardBasePath} className="hover:underline">
                  Dashboard
                </Link>
                <span>&gt;</span>
                <span className="text-[#344054]">Workflow Library</span>
              </nav>
              <nav className="flex flex-wrap items-center gap-6 text-sm text-[#012352]" aria-label="Workflow tabs">
                <span className="cursor-pointer">Builder</span>
                <Link href="/admin_recruiter/dashboard/templates" className="cursor-pointer">
                  Templates
                </Link>
                <Link href="/admin_recruiter/dashboard/onboarding-flows" className="cursor-pointer">
                  Workflows
                </Link>
                <Link
                  href="/admin_recruiter/dashboard/workflowlibrary"
                  className="cursor-pointer border-b-2 border-[color:var(--brand-primary)] pb-1 text-[color:var(--brand-primary)]"
                >
                  Library
                </Link>
              </nav>
            </div>
          </div>
        ) : !embeddedInAdminShell ? (
          <nav
            className="mb-4 text-[13px] leading-5"
            style={{ color: TEXT_MUTED }}
            aria-label="Breadcrumb"
          >
            <Link href={dashboardBasePath} className="hover:underline">
              Dashboard
            </Link>
            <span className="mx-1.5">&gt;</span>
            <span style={{ color: TEXT_SECONDARY }}>Workflow Library</span>
          </nav>
        ) : null}

        {/* Title row + actions */}
        <header className="mb-6 flex flex-col gap-4 min-[480px]:mb-10 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between min-[480px]:gap-4 sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className="text-[22px] font-semibold leading-[28px] tracking-normal text-[#000000] max-[369px]:text-[20px] max-[369px]:leading-[26px] min-[480px]:text-[20px] min-[480px]:leading-[26px] min-[700px]:text-[24px] min-[700px]:leading-[30px] min-[900px]:text-[30px] min-[900px]:leading-[36px]">
              Workflow Library
            </h1>
            <p className="mt-2 text-[13px] font-normal leading-5 text-[#374151] min-[700px]:text-[14px] min-[900px]:mt-3 min-[900px]:text-[16px] min-[900px]:leading-6">
              Manage workflows library
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2.5 max-[479px]:w-full min-[480px]:w-auto min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end min-[480px]:gap-3">
            <button
              type="button"
              onClick={() => setCreateFolderModalOpen(true)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold transition hover:bg-[#fafafa] min-[480px]:w-auto"
              style={{ borderColor: "#344054", color: TEXT_PRIMARY }}
            >
              <AddLibraryIcon />
              Add library
            </button>
            <Link
              href={`${dashboardBasePath}/onboarding-flows`}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-[0.97] min-[480px]:w-auto"
              style={{ background: NAVY_GRADIENT }}
            >
              <CreateFlowIcon />
              Create new flow
            </Link>
          </div>
        </header>

        {/* Cards */}
        <section aria-label="Workflow libraries">
          {!tenantId && !librariesLoading ? (
            <p className="py-12 text-center text-sm" style={{ color: TEXT_SECONDARY }}>
              Select a tenant to view workflow libraries.
            </p>
          ) : librariesError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {librariesError instanceof Error ? librariesError.message : "Failed to load libraries"}
            </div>
          ) : librariesLoading || librariesFetching ? (
            <CandidateDetailLoader label="Loading libraries…" className="min-h-[200px] bg-transparent py-10" />
          ) : libraries.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: TEXT_SECONDARY }}>
              No workflow libraries found.
            </p>
          ) : (
            <>
              {uncategorizedLibrary ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FlowLibraryCard
                    library={mapLibrary(uncategorizedLibrary)}
                    dashboardBasePath={dashboardBasePath}
                  />
                </div>
              ) : null}

              <hr
                className="my-8 border-0 border-t sm:my-10"
                style={{ borderColor: "#e4e7ec" }}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {folderLibraries.length === 0 ? (
                  <p className="text-sm" style={{ color: TEXT_SECONDARY }}>
                    No libraries yet. Create one to organize your flows.
                  </p>
                ) : (
                  folderLibraries.map((lib) => (
                    <FlowLibraryCard
                      key={lib.id}
                      library={mapLibrary(lib)}
                      dashboardBasePath={dashboardBasePath}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <CreateFolderModal
        open={createFolderModalOpen}
        onClose={() => setCreateFolderModalOpen(false)}
        flowOptions={flowOptions}
        saving={creatingLibrary}
        onCreated={async (name) => {
          try {
            const library = await createLibrary({ name });
            setCreatedFolderName(name);
            setCreatedLibraryId(library.id);
            setSuccessModalOpen(true);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to create library");
          }
        }}
      />

      <FolderCreatedSuccessModal
        open={successModalOpen}
        folderName={createdFolderName}
        folderHref={
          createdLibraryId
            ? `${dashboardBasePath}/onboarding-flows?library=${createdLibraryId}`
            : `${dashboardBasePath}/onboarding-flows`
        }
        onClose={() => setSuccessModalOpen(false)}
      />
    </div>
  );
}

export default function BraasWorkflowLibraryPage() {
  return <WorkflowLibraryPage dashboardBasePath="/braas-hr/dashboard" />;
}
