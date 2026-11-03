"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, GitBranch, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { dispatchCandidatePipelineRefresh } from "@/lib/admin/candidate-pipeline-events";
import { invalidateStaffDetailCache } from "@/lib/admin/staff-detail-fetch-cache";
import { CandidateWorkflowReassignConfirmModal } from "./CandidateWorkflowReassignConfirmModal";

type WorkflowOption = {
  id: string;
  name: string;
  employmentType?: string | null;
};

type ReassignOptionsPayload = {
  applicationId: string | null;
  currentWorkflowId: string | null;
  currentWorkflowName: string | null;
  workflows: WorkflowOption[];
  error?: string;
};

type UpdateAssignedWorkflowControlProps = {
  workerId: string;
  disabled?: boolean;
  className?: string;
  /** Optional override so the trigger matches surrounding header button styles (e.g. 2.0 outline). */
  buttonClassName?: string;
};

const actionBtnBase =
  "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border bg-white px-1.5 text-center text-[10px] font-semibold leading-4 disabled:cursor-not-allowed disabled:opacity-50 min-[700px]:h-8 min-[700px]:flex-none min-[700px]:gap-1.5 min-[700px]:px-3 min-[700px]:text-xs";

export default function UpdateAssignedWorkflowControl({
  workerId,
  disabled = false,
  className,
  buttonClassName,
}: UpdateAssignedWorkflowControlProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowOption | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!workerId.trim()) return;
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/reassign-workflow`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ReassignOptionsPayload;
      if (!res.ok) throw new Error(json.error || "Failed to load workflows");
      setApplicationId(json.applicationId);
      setCurrentWorkflowId(json.currentWorkflowId);
      setCurrentWorkflowName(json.currentWorkflowName);
      setWorkflows(Array.isArray(json.workflows) ? json.workflows : []);
    } catch (err) {
      setOptionsError(err instanceof Error ? err.message : "Failed to load workflows");
      setWorkflows([]);
    } finally {
      setLoadingOptions(false);
    }
  }, [workerId]);

  useEffect(() => {
    if (!open) return;
    void loadOptions();
  }, [open, loadOptions]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmOpen) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, confirmOpen]);

  const closeConfirm = useCallback(() => {
    if (busy) return;
    setConfirmOpen(false);
    setPendingWorkflow(null);
  }, [busy]);

  const selectWorkflow = (workflow: WorkflowOption) => {
    if (workflow.id === currentWorkflowId) {
      toast("Candidate is already on this workflow.");
      setOpen(false);
      return;
    }
    setPendingWorkflow(workflow);
    setConfirmOpen(true);
    setOpen(false);
  };

  const confirmUpdate = async () => {
    if (!pendingWorkflow || !workerId.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/reassign-workflow`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowId: pendingWorkflow.id,
            applicationId: applicationId ?? undefined,
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        workflowName?: string | null;
        stepsPreserved?: number;
      };
      if (!res.ok) throw new Error(json.error || "Failed to update assigned workflow");

      setCurrentWorkflowId(pendingWorkflow.id);
      setCurrentWorkflowName(json.workflowName ?? pendingWorkflow.name);
      setConfirmOpen(false);
      setPendingWorkflow(null);

      invalidateStaffDetailCache(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/workflow-phases`
      );
      invalidateStaffDetailCache(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/profile`
      );
      dispatchCandidatePipelineRefresh(workerId);

      toast.success(
        json.message ||
          `Assigned workflow updated to ${json.workflowName ?? pendingWorkflow.name}.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update assigned workflow");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div ref={rootRef} className={`relative ${className ?? ""}`}>
        <button
          type="button"
          disabled={disabled || busy}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          title="Update assigned workflow for this candidate"
          className={
            buttonClassName?.trim() ||
            `${actionBtnBase} border-[color:var(--brand-primary)] text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]`
          }
        >
          {busy ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <GitBranch className="size-3.5 shrink-0" aria-hidden />
          )}
          <span>Update assigned workflow</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label="Select workflow"
            className="absolute right-0 z-40 mt-1 max-h-72 w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
          >
            {loadingOptions ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-[#667085]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading workflows…
              </div>
            ) : optionsError ? (
              <div className="px-3 py-3 text-xs text-red-700">{optionsError}</div>
            ) : !applicationId ? (
              <div className="px-3 py-3 text-xs text-[#667085]">
                No active application found for this candidate.
              </div>
            ) : workflows.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#667085]">
                No published workflows available.
              </div>
            ) : (
              workflows.map((workflow) => {
                const selected = workflow.id === currentWorkflowId;
                return (
                  <button
                    key={workflow.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy}
                    onClick={() => selectWorkflow(workflow)}
                    className={`flex w-full items-start px-3 py-2 text-left text-xs hover:bg-[#F8FAFC] ${
                      selected ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[#111827]">{workflow.name}</span>
                      {selected ? (
                        <span className="mt-0.5 block text-[10px] text-[#667085]">
                          Currently assigned
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <CandidateWorkflowReassignConfirmModal
        open={confirmOpen}
        previousWorkflowName={currentWorkflowName}
        nextWorkflowName={pendingWorkflow?.name ?? null}
        busy={busy}
        onNo={closeConfirm}
        onYes={() => void confirmUpdate()}
      />
    </>
  );
}
