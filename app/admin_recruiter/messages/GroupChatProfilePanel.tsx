"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Search, UserPlus, Users, X } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import GroupStackedAvatars, { SingleChatAvatar } from "@/app/admin_recruiter/messages/GroupStackedAvatars";
import type { GroupMemberRow } from "@/lib/messaging/group-conversations";

type WorkerOption = {
  id: string;
  name: string;
  email: string | null;
  jobRole: string | null;
};

function formatCreatedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export default function GroupChatProfilePanel({
  groupId,
  groupName,
  createdAt,
  memberInitials,
  onRemoved,
  onMembersChanged,
}: {
  groupId: string;
  groupName: string;
  createdAt: string;
  memberInitials: string[];
  onRemoved: () => void;
  onMembersChanged: () => void;
}) {
  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/admin/messages/groups/${encodeURIComponent(groupId)}/members`, {
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      members?: GroupMemberRow[];
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load members.");
    setMembers(payload.members ?? []);
  }, [groupId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        await loadMembers();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load members.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupId, loadMembers]);

  useEffect(() => {
    if (!showAddModal) return;
    let alive = true;
    setLoadingWorkers(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ excludeGroupId: groupId });
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
  }, [groupId, search, showAddModal]);

  const visibleMembers = showAll ? members : members.slice(0, 6);

  async function handleAddMembers() {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messages/groups/${encodeURIComponent(groupId)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerIds: selectedIds }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not add members.");
      setShowAddModal(false);
      setSelectedIds([]);
      setSearch("");
      await loadMembers();
      onMembersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add members.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(workerId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/messages/groups/${encodeURIComponent(groupId)}/members?workerId=${encodeURIComponent(workerId)}`,
        { method: "DELETE" }
      );
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not remove member.");
      await loadMembers();
      onMembersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member.");
    }
  }

  async function handleRemoveGroup() {
    if (!window.confirm(`Remove group "${groupName}"? This cannot be undone.`)) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messages/groups/${encodeURIComponent(groupId)}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not remove group.");
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove group.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm xl:h-full">
        {loading ? (
          <CandidateDetailLoader label="Loading group..." className="min-h-0 flex-1 bg-transparent" />
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pt-[30px] pb-5">
              <div className="flex flex-col items-center text-center">
                <GroupStackedAvatars initials={memberInitials} size={40} max={4} />
                <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">{groupName}</h3>
                <p className="mt-1 text-sm text-[#64748B]">{members.length} members</p>
              </div>

              <div className="space-y-3 rounded-xl border border-[#E8EDF2] px-3 py-3">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
                  <div className="min-w-0 text-sm text-[#334155]">
                    <span className="text-[#64748B]">Group Name:</span> {groupName}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock3 className="h-4 w-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
                  <div className="min-w-0 text-sm text-[#334155]">
                    <span className="text-[#64748B]">Date Created:</span> {formatCreatedDate(createdAt)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={removing}
                onClick={() => void handleRemoveGroup()}
                className="flex h-10 w-full items-center justify-center rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#64748B] transition hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove Group"}
              </button>

              <div className="border-t border-[#E8EDF2] pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#0F172A]">Members</p>
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    >
                      {members.length}
                    </span>
                  </div>
                  {members.length > 6 ? (
                    <button
                      type="button"
                      onClick={() => setShowAll((current) => !current)}
                      className="text-xs font-medium text-(--brand-primary)"
                    >
                      {showAll ? "Show less" : "Show All"}
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC]"
                >
                  <UserPlus className="h-4 w-4" />
                  Add workers
                </button>

                <div className="space-y-2">
                  {visibleMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#F1F5F9] px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <SingleChatAvatar name={member.user_name} size={30} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#0F172A]">{member.user_name}</p>
                          <p className="text-xs text-[#64748B]">Worker</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${member.user_name}`}
                        onClick={() => void handleRemoveMember(member.user_id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#64748B]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        {error ? (
          <div className="border-t border-[#E8EDF2] px-5 py-4 text-sm font-medium text-red-700">{error}</div>
        ) : null}
      </aside>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8EDF2] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[#0F172A]">Add workers</h2>
                <p className="mt-1 text-sm text-[#64748B]">Add more workers to {groupName}.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowAddModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search workers..."
                  className="h-10 w-full rounded-lg border border-[#D8E0EA] py-2 pl-9 pr-3 text-sm text-[#0F172A] outline-none focus:border-(--brand-primary)"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-[#E8EDF2]">
                {loadingWorkers ? (
                  <CandidateDetailLoader label="Loading workers..." className="min-h-[120px] bg-transparent py-6" />
                ) : workers.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#64748B]">No workers available to add.</p>
                ) : (
                  workers.map((worker) => {
                    const selected = selectedIds.includes(worker.id);
                    return (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() =>
                          setSelectedIds((current) =>
                            current.includes(worker.id)
                              ? current.filter((id) => id !== worker.id)
                              : [...current, worker.id]
                          )
                        }
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
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-[#D8E0EA] px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || selectedIds.length === 0}
                onClick={() => void handleAddMembers()}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                }}
              >
                {submitting ? "Adding..." : "Add selected"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
