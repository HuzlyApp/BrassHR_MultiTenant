"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WORKER_BTN_OUTLINE, WORKER_BTN_PRIMARY } from "./worker-portal-buttons";

type ProfileSkill = {
  id: string;
  skill_name: string;
  created_at: string | null;
};

type EditWorkerSkillsModalProps = {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
};

export function EditWorkerSkillsModal({ open, onClose, onChanged }: EditWorkerSkillsModalProps) {
  const { authHeaders } = useApplicantPortal();
  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [skillName, setSkillName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSkillName("");
      setSaving(false);
      setRemovingId(null);
      return;
    }

    let alive = true;

    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("You need to sign in again.");
        const res = await fetch("/api/applicant-portal/profile-skills", {
          headers,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          skills?: ProfileSkill[];
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load skills");
        if (!alive) return;
        setSkills(payload.skills ?? []);
      } catch (error) {
        if (alive) {
          toast.error(error instanceof Error ? error.message : "Could not load skills");
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, open]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = skillName.trim();
    if (!trimmed) {
      toast.error("Enter a skill name");
      return;
    }

    setSaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/profile-skills", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ skillName: trimmed }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        skills?: ProfileSkill[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not add skill");
      setSkills(payload.skills ?? []);
      setSkillName("");
      toast.success("Skill added");
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add skill");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(skillId: string) {
    setRemovingId(skillId);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(
        `/api/applicant-portal/profile-skills?skillId=${encodeURIComponent(skillId)}`,
        { method: "DELETE", headers }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        skills?: ProfileSkill[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not remove skill");
      setSkills(payload.skills ?? []);
      toast.success("Skill removed");
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove skill");
    } finally {
      setRemovingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1F2937]">Edit Skills</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close edit skills modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-[#6B7280]">Skills on your profile</p>
          {skills.length === 0 ? (
            <p className="mt-3 text-sm text-[#9CA3AF]">No skills added yet.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8]"
                >
                  {skill.skill_name}
                  <button
                    type="button"
                    onClick={() => void handleRemove(skill.id)}
                    disabled={removingId === skill.id}
                    className="rounded-full p-0.5 text-[#1D4ED8] hover:bg-[#BFDBFE] disabled:opacity-60"
                    aria-label={`Remove ${skill.skill_name}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form onSubmit={(event) => void handleAdd(event)} className="mt-6">
            <label htmlFor="edit-worker-skill-name" className="block text-sm font-medium text-[#374151]">
              Add a skill
            </label>
            <input
              id="edit-worker-skill-name"
              type="text"
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
              placeholder="e.g. Wound Care"
              maxLength={120}
              className="mt-2 w-full rounded-lg border border-[#D1D5DB] px-4 py-3 text-base text-[#111827] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
              autoFocus
            />

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} className={WORKER_BTN_OUTLINE}>
                Done
              </button>
              <button type="submit" disabled={saving} className={`${WORKER_BTN_PRIMARY} disabled:opacity-60`}>
                {saving ? "Saving..." : "Add skill"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
