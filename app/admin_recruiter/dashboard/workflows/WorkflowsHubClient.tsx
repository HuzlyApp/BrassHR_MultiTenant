"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { OnboardingFlowsPage } from "@/app/braas-hr/dashboard/onboarding-flows/page";
import WorkflowMappingsClient from "@/app/admin_recruiter/dashboard/workflow-mappings/WorkflowMappingsClient";
import AdminRecruiterTemplatesPage from "@/app/admin_recruiter/dashboard/templates/page";
import { useOnboardingLibraries } from "@/lib/onboarding/hooks/use-onboarding-libraries";

const WORKFLOWS_HREF = "/admin_recruiter/dashboard/onboarding-flows";

export type WorkflowsHubTab = "workflows" | "templates" | "mappings";

const TABS: Array<{ id: WorkflowsHubTab; label: string }> = [
  { id: "workflows", label: "Workflows" },
  { id: "templates", label: "Templates" },
  { id: "mappings", label: "Mappings" },
];

function parseTab(value: string | null): WorkflowsHubTab {
  if (value === "templates" || value === "mappings" || value === "workflows") return value;
  return "workflows";
}

function CreateFolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 5.5C2.5 4.67157 3.17157 4 4 4H6.58579C6.851 4 7.10536 4.10536 7.29289 4.29289L8.20711 5.20711C8.39464 5.39464 8.649 5.5 8.91421 5.5H12C12.8284 5.5 13.5 6.17157 13.5 7V11C13.5 11.8284 12.8284 12.5 12 12.5H4C3.17157 12.5 2.5 11.8284 2.5 11V5.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8 7.75V10.25M6.75 9H9.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CreateFlowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type CreateFolderDialogProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
};

function CreateFolderDialog({ open, saving, onClose, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState("");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflows-create-folder-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="workflows-create-folder-title" className="text-lg font-semibold text-[#101828]">
          Create a folder
        </h2>
        <p className="mt-1 text-sm text-[#667085]">Organize onboarding flows into a named library folder.</p>
        <label className="mt-5 block text-sm font-medium text-[#344054]" htmlFor="workflows-folder-name">
          Folder name
        </label>
        <input
          id="workflows-folder-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
          placeholder="Enter folder name"
          autoFocus
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void onCreate(name.trim())}
            className="h-10 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowsHubContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const [createFlowSignal, setCreateFlowSignal] = useState(0);
  const [createMappingSignal, setCreateMappingSignal] = useState(0);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderSaving, setFolderSaving] = useState(false);
  const { createLibrary } = useOnboardingLibraries();

  const pageTitle =
    activeTab === "mappings" ? "Mappings" : activeTab === "templates" ? "Templates" : "Workflows";

  const setTab = useCallback(
    (tab: WorkflowsHubTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "workflows") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      setFolderSaving(true);
      try {
        const library = await createLibrary({ name });
        toast.success(`Created folder “${name}”`);
        setFolderOpen(false);
        router.push(`${WORKFLOWS_HREF}?library=${library.id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create folder");
      } finally {
        setFolderSaving(false);
      }
    },
    [createLibrary, router]
  );

  const headerActions = useMemo(() => {
    if (activeTab === "workflows") {
      return (
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setFolderOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <CreateFolderIcon />
            Create a folder
          </button>
          <button
            type="button"
            onClick={() => setCreateFlowSignal((value) => value + 1)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#101828] bg-white px-4 text-sm font-semibold text-[#101828] transition hover:bg-[#F8FAFC]"
          >
            <CreateFlowIcon />
            Create a flow
          </button>
        </div>
      );
    }
    if (activeTab === "mappings") {
      return (
        <button
          type="button"
          onClick={() => setCreateMappingSignal((value) => value + 1)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#101828] px-5 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
        >
          Create Mapping
        </button>
      );
    }
    return null;
  }, [activeTab]);

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-[#101828] sm:text-[30px]">
            {pageTitle}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#667085] sm:text-[15px]">
            Create and manage automated workflows to streamline daily tasks.
          </p>
        </div>
        {headerActions}
      </header>

      <nav
        className="mb-6 flex items-center gap-6 border-b border-[#E4E7EC]"
        aria-label="Workflow sections"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`relative -mb-px pb-3 text-sm font-semibold transition ${
                selected ? "text-[color:var(--brand-primary)]" : "text-[#667085] hover:text-[#344054]"
              }`}
              aria-current={selected ? "page" : undefined}
            >
              {tab.label}
              {selected ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[color:var(--brand-primary)]" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {activeTab === "workflows" ? (
        <OnboardingFlowsPage
          dashboardBasePath="/admin_recruiter/dashboard"
          embeddedInAdminShell
          hubMode
          openCreateFlowSignal={createFlowSignal}
        />
      ) : null}

      {activeTab === "templates" ? <AdminRecruiterTemplatesPage embedded /> : null}

      {activeTab === "mappings" ? (
        <WorkflowMappingsClient embedded openCreateSignal={createMappingSignal} />
      ) : null}

      <CreateFolderDialog
        open={folderOpen}
        saving={folderSaving}
        onClose={() => {
          if (!folderSaving) setFolderOpen(false);
        }}
        onCreate={handleCreateFolder}
      />
    </div>
  );
}

export default function WorkflowsHubClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <CandidateDetailLoader />
        </div>
      }
    >
      <WorkflowsHubContent />
    </Suspense>
  );
}

export function workflowsHubHref(tab: WorkflowsHubTab = "workflows"): string {
  if (tab === "workflows") return WORKFLOWS_HREF;
  return `${WORKFLOWS_HREF}?tab=${tab}`;
}
