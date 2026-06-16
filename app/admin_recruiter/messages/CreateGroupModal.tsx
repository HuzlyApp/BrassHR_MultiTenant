"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";

type WorkerOption = {
  id: string;
  name: string;
  email: string | null;
  jobRole: string | null;
};

export default function CreateGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}) {
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSearch("");
    setSelectedIds([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadingWorkers(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams();
          if (search.trim()) params.set("q", search.trim());
          const res = await fetch(`/api/admin/messages/workers?${params.toString()}`, {
            cache: "no-store",
          });
          const payload = (await res.json().catch(() => ({}))) as {
            workers?: WorkerOption[];
            error?: string;
          };
          if (!alive) return;
          if (!res.ok) throw new Error(payload.error || "Could not load workers.");
          setWorkers(payload.workers ?? []);
        } catch (err) {
          if (alive) setError(err instanceof Error ? err.message : "Could not load workers.");
        } finally {
          if (alive) setLoadingWorkers(false);
        }
      })();
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  const selectedWorkers = useMemo(
    () => workers.filter((worker) => selectedIds.includes(worker.id)),
    [selectedIds, workers]
  );

  if (!open) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/messages/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), workerIds: selectedIds }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        group?: { id: string };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not create group.");
      onCreated(payload.group?.id ?? "");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleWorker(workerId: string) {
    setSelectedIds((current) =>
      current.includes(workerId) ? current.filter((id) => id !== workerId) : [...current, workerId]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E8EDF2] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">Create a new group</h2>
            <p className="mt-1 text-sm text-[#64748B]">Add workers to start a group conversation.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#334155]">Group name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Night shift onboarding"
              className="h-10 w-full rounded-lg border border-[#D8E0EA] px-3 text-sm text-[#0F172A] outline-none focus:border-(--brand-primary)"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#334155]">Add workers</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workers..."
                className="h-10 w-full rounded-lg border border-[#D8E0EA] py-2 pl-9 pr-3 text-sm text-[#0F172A] outline-none focus:border-(--brand-primary)"
              />
            </div>
          </div>

          {selectedWorkers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedWorkers.map((worker) => (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => toggleWorker(worker.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#D8E0EA] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#334155]"
                >
                  {worker.name}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-56 overflow-y-auto rounded-lg border border-[#E8EDF2]">
            {loadingWorkers ? (
              <CandidateDetailLoader label="Loading workers..." className="min-h-[120px] bg-transparent py-6" />
            ) : workers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#64748B]">No workers found.</p>
            ) : (
              workers.map((worker) => {
                const selected = selectedIds.includes(worker.id);
                return (
                  <button
                    key={worker.id}
                    type="button"
                    onClick={() => toggleWorker(worker.id)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-[#F1F5F9] px-4 py-3 text-left transition last:border-b-0 ${
                      selected ? "bg-[#F8FAFC]" : "hover:bg-[#FAFBFC]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0F172A]">{worker.name}</p>
                      <p className="truncate text-xs text-[#64748B]">
                        {worker.jobRole || worker.email || "Worker"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected
                          ? "border-(--brand-primary) bg-(--brand-primary) text-white"
                          : "border-[#CBD5E1] text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E8EDF2] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#D8E0EA] px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !name.trim() || selectedIds.length === 0}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
            }}
          >
            <UserPlus className="h-4 w-4" />
            {submitting ? "Creating..." : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
