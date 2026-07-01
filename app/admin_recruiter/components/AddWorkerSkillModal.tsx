"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";

type AddWorkerSkillModalProps = {
  open: boolean;
  workerId: string;
  onClose: () => void;
  onAdded?: () => void | Promise<void>;
};

export default function AddWorkerSkillModal({
  open,
  workerId,
  onClose,
  onAdded,
}: AddWorkerSkillModalProps) {
  const [skillName, setSkillName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSkillName("");
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = skillName.trim();
    if (!trimmed) {
      toast.error("Enter a skill name");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/worker-profile-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, skillName: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Could not add skill");
      }
      toast.success("Skill added");
      await onAdded?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add skill";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1F2937]">Add skill</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close add skill modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="px-6 py-5">
          <label htmlFor="worker-skill-name" className="block text-sm font-medium text-[#374151]">
            Skill name
          </label>
          <input
            id="worker-skill-name"
            type="text"
            value={skillName}
            onChange={(event) => setSkillName(event.target.value)}
            placeholder="e.g. Wound Care"
            maxLength={120}
            className="mt-2 w-full rounded-lg border border-[#D1D5DB] px-4 py-3 text-base text-[#111827] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
            autoFocus
          />

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] px-4 text-sm font-semibold text-[#374151]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add skill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
