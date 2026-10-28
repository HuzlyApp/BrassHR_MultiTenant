"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import toast from "react-hot-toast";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { useOnboardingLibraries } from "@/lib/onboarding/hooks/use-onboarding-libraries";
import { useOnboardingFlows } from "@/lib/onboarding/hooks/use-onboarding-flows";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import { GOLD_GRADIENT, NAVY_GRADIENT } from "../constants";

const CREATE_FOLDER_ICONS = {
  close: "/icons/create-folder/icon-outline-x.svg",
  folder: "/icons/create-folder/folder-open.svg",
  chevron: "/icons/create-folder/chevron-down.svg",
  search: "/icons/create-folder/search.svg",
  flows: "/icons/create-folder/flows.svg",
  flowsActive: "/icons/create-folder/flows-alt.svg",
  check: "/icons/create-folder/check.svg",
} as const;

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
    <div ref={containerRef} className="w-full">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-lg border border-[#cbd5e1] bg-white py-3.5 pl-3.5 pr-1.5 text-left outline-none"
      >
        <span className="text-sm font-normal leading-5 text-[#94a3b8]">Select flow</span>
        <img src={CREATE_FOLDER_ICONS.chevron} width={20} height={20} alt="" />
      </button>

      {open ? (
        <div className="flex w-full items-stretch gap-0.5 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white p-1">
          <div className="min-w-0 flex-1">
            <div className="border-b border-[#e5e7eb] py-1">
              <div className="flex h-9 items-center justify-between rounded-lg bg-white px-2.5 py-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder="Search flow..."
                  aria-label="Search flow"
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-5 text-black outline-none placeholder:text-[#94a3b8]"
                />
                <img src={CREATE_FOLDER_ICONS.search} width={16} height={16} alt="" />
              </div>
            </div>
            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              aria-label="Flows"
              className="max-h-[72px] overflow-y-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#cbd5e1]"
            >
              {filteredFlows.length === 0 ? (
                <li className="px-2 py-2 text-sm leading-5 text-[#94a3b8]">No flows found</li>
              ) : (
                filteredFlows.map((flow) => {
                  const checked = selectedIds.includes(flow.id);
                  return (
                    <li key={flow.id} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        onClick={() => toggleFlow(flow.id)}
                        className="group flex w-full items-center justify-between p-2 text-left hover:bg-[#f4f4f4]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <img
                            src={CREATE_FOLDER_ICONS.flows}
                            width={18}
                            height={18}
                            alt=""
                            className="group-hover:hidden"
                          />
                          <img
                            src={CREATE_FOLDER_ICONS.flowsActive}
                            width={18}
                            height={18}
                            alt=""
                            className="hidden group-hover:block"
                          />
                          <span className="truncate text-sm font-normal leading-5 text-[#374151]">
                            {flow.label}
                          </span>
                        </span>
                        <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
                          <span
                            className={`relative size-4 overflow-hidden rounded-[4px] border ${
                              checked
                                ? "border-[#012352] bg-[#012352]"
                                : "border-[#cbd5e1] bg-white"
                            }`}
                          >
                            {checked ? (
                              <img
                                src={CREATE_FOLDER_ICONS.check}
                                width={12}
                                height={12}
                                alt=""
                                className="absolute left-px top-px"
                              />
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {addedCount > 0 ? (
        <p className="flex justify-end p-1 text-[10px] font-normal leading-[15px] text-[#374151]">
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
  onCreated: (folderName: string, flowIds: string[]) => void | Promise<void>;
  flowOptions: FlowOption[];
  saving?: boolean;
};

function CreateFolderModal({ open, onClose, onCreated, flowOptions, saving = false }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);

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
  }, [open]);

  const handleCreate = useCallback(async () => {
    const name = folderName.trim();
    if (!name || saving) return;
    try {
      await onCreated(name, selectedFlowIds);
      onClose();
    } catch {
      // The caller reports the error and leaves the dialog open.
    }
  }, [folderName, onCreated, onClose, saving, selectedFlowIds]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/20 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-folder-title"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-[600px] overflow-hidden rounded-[20px] border border-[#e5e7eb] bg-white shadow-[0_10px_10px_-5px_rgba(0,0,0,0.04),0_20px_25px_-5px_rgba(0,0,0,0.1)]"
        style={{ fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end border-b border-[#e5e7eb] px-3.5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-full bg-black"
            aria-label="Close"
          >
            <img src={CREATE_FOLDER_ICONS.close} width={18} height={18} alt="" />
          </button>
        </div>

        <form
          className="flex max-h-[min(92dvh,760px)] flex-col gap-5 overflow-y-auto p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#bc8b41] bg-[#f4f4f4] p-2">
              <img src={CREATE_FOLDER_ICONS.folder} width={20} height={20} alt="" />
            </div>
            <h2 id="create-folder-title" className="text-2xl font-semibold leading-8 text-black">
              Create a folder
            </h2>
          </div>

          <div className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-2">
              <label htmlFor="folder-name" className="text-sm font-normal leading-5 text-[#374151]">
                Folder Name
              </label>
              <input
                id="folder-name"
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-[#cbd5e1] bg-white px-3.5 text-sm font-normal leading-5 text-black outline-none placeholder:text-[#94a3b8]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="save-templates-to" className="text-sm font-normal leading-5 text-[#374151]">
                  Save templates to
                </label>
                <span className="text-xs font-normal leading-4 text-[#94a3b8]">Optional</span>
              </div>
              <FlowMultiSelect
                id="save-templates-to"
                selectedIds={selectedFlowIds}
                onChange={setSelectedFlowIds}
                options={flowOptions}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-xs font-semibold leading-4 text-[#374151]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !folderName.trim()}
              className="flex flex-1 items-center justify-center rounded-lg bg-[#bc8b41] px-3.5 py-2.5 text-xs font-semibold leading-4 text-white disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function assignFlowsToLibrary(libraryId: string, flowIds: string[]) {
  await Promise.all(
    flowIds.map(async (flowId) => {
      const res = await fetch(`/api/admin/onboarding-flows/${flowId}`, {
        ...(await staffFetchInit({ "Content-Type": "application/json" })),
        method: "PATCH",
        body: JSON.stringify({ libraryId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to save templates to this folder");
      }
    })
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
    refetch: refetchLibraries,
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
        onCreated={async (name, flowIds) => {
          let library: Awaited<ReturnType<typeof createLibrary>>;
          try {
            library = await createLibrary({ name });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to create library");
            throw e;
          }
          if (flowIds.length > 0) {
            try {
              await assignFlowsToLibrary(library.id, flowIds);
              await refetchLibraries();
            } catch (e) {
              toast.error(
                e instanceof Error
                  ? e.message
                  : "Folder was created, but the selected templates could not be saved"
              );
            }
          }
          setCreatedFolderName(name);
          setCreatedLibraryId(library.id);
          setSuccessModalOpen(true);
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
