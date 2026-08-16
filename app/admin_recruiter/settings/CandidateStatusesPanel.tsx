"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical, ListChecks, Plus, Pencil } from "lucide-react";
import toast from "react-hot-toast";

type StatusItem = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  systemKey: string | null;
};

export default function CandidateStatusesPanel() {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/application-statuses");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load statuses");
      setStatuses(
        ((payload.statuses ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          description: (row.description as string | null) ?? null,
          color: (row.color as string | null) ?? null,
          sortOrder: Number(row.sortOrder ?? 0),
          isActive: Boolean(row.isActive),
          isDefault: Boolean(row.isDefault),
          systemKey: (row.systemKey as string | null) ?? null,
        }))
      );
      setCanManage(Boolean(payload.canManage));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load statuses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addStatus() {
    if (!draftName.trim()) {
      toast.error("Status name is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/application-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          description: draftDescription.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create status");
      setDraftName("");
      setDraftDescription("");
      toast.success("Status created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create status");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(statusId: string) {
    if (!editName.trim()) {
      toast.error("Status name is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/application-statuses/${encodeURIComponent(statusId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update status");
      setEditingId(null);
      toast.success("Status updated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(status: StatusItem) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/application-statuses/${encodeURIComponent(status.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !status.isActive }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update status");
      toast.success(status.isActive ? "Status deactivated" : "Status activated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  async function move(statusId: string, direction: -1 | 1) {
    const index = statuses.findIndex((s) => s.id === statusId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= statuses.length) return;
    const next = [...statuses];
    const [item] = next.splice(index, 1);
    next.splice(swapIndex, 0, item);
    setStatuses(next);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/application-statuses/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((s) => s.id) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to reorder");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#012352]">
          <ListChecks className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-base font-semibold text-[#0F172A]">Candidate Statuses</h3>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Configure recruiting statuses for job applications. Recruiters can assign these statuses
            and optionally add a note when changing status.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading statuses…</p>
      ) : (
        <ul className="space-y-2">
          {statuses.map((status, index) => (
            <li
              key={status.id}
              className="flex flex-col gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              {editingId === status.id ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm"
                    placeholder="Status name"
                  />
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm"
                    placeholder="Description (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveEdit(status.id)}
                      className="rounded-lg bg-[#012352] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {index + 1}. {status.name}
                    </span>
                    {status.isDefault ? (
                      <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#475569]">
                        Default
                      </span>
                    ) : null}
                    {!status.isActive ? (
                      <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#B91C1C]">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  {status.description ? (
                    <p className="mt-0.5 pl-6 text-xs text-[#64748B]">{status.description}</p>
                  ) : null}
                </div>
              )}

              {canManage && editingId !== status.id ? (
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={saving || index === 0}
                    onClick={() => void move(status.id, -1)}
                    className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155] disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    disabled={saving || index === statuses.length - 1}
                    onClick={() => void move(status.id, 1)}
                    className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155] disabled:opacity-40"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(status.id);
                      setEditName(status.name);
                      setEditDescription(status.description ?? "");
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155]"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={saving || (status.isDefault && status.isActive)}
                    onClick={() => void toggleActive(status)}
                    className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155] disabled:opacity-40"
                  >
                    {status.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="mt-5 space-y-2 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3">
          <p className="text-sm font-semibold text-[#0F172A]">Add status</p>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm"
            placeholder="Name"
          />
          <input
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm"
            placeholder="Description (optional)"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void addStatus()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#012352] px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Status
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[#64748B]">
          Only administrators can create or edit status definitions.
        </p>
      )}
    </section>
  );
}
