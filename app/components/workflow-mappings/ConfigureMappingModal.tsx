"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { EmploymentType, PlacementType } from "@/lib/jobs/types";

type ConfigureMappingModalProps = {
  open: boolean;
  workflowId: string;
  workflowName: string;
  suggestedEmploymentType?: EmploymentType | null;
  onClose: () => void;
  onSaved?: () => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export default function ConfigureMappingModal({
  open,
  workflowId,
  workflowName,
  suggestedEmploymentType,
  onClose,
  onSaved,
}: ConfigureMappingModalProps) {
  const [professionId, setProfessionId] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(suggestedEmploymentType ?? "W2");
  const [placementType, setPlacementType] = useState<PlacementType>("Internal");
  const [saving, setSaving] = useState(false);
  const [professions, setProfessions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setEmploymentType(suggestedEmploymentType ?? "W2");
    void fetch("/api/admin/workflow-mappings/options", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load options");
        setProfessions(payload.professions ?? []);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load options"));
  }, [open, suggestedEmploymentType]);

  if (!open) return null;

  async function saveMapping() {
    if (!professionId) {
      toast.error("Select a profession.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/workflow-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionId,
          employmentType,
          placementType,
          workflowId,
          isActive: true,
          priority: 100,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create mapping");
      toast.success("Automatic assignment configured");
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create mapping");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Configure automatic assignment</h2>
        <p className="mt-1 text-sm text-slate-600">
          Link <span className="font-medium">{workflowName}</span> to job criteria so recruiters do not
          manually assign workflows.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Profession</span>
            <select className={inputClass} value={professionId} onChange={(e) => setProfessionId(e.target.value)}>
              <option value="">Select profession</option>
              {professions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Employment type</span>
            <select
              className={inputClass}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
            >
              <option>W2</option>
              <option>1099</option>
              <option>Contract</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Placement type</span>
            <select
              className={inputClass}
              value={placementType}
              onChange={(e) => setPlacementType(e.target.value as PlacementType)}
            >
              <option>Internal</option>
              <option>Recruit_and_Release</option>
              <option>Recruit_and_EOR</option>
            </select>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Skip for now
          </button>
          <Link
            href={`/admin_recruiter/dashboard/workflow-mappings?workflowId=${workflowId}&professionId=${professionId}&employmentType=${employmentType}&placementType=${placementType}`}
            className="rounded-lg border border-teal-200 px-4 py-2 text-sm font-medium text-teal-700"
          >
            Open mappings
          </Link>
          <button
            type="button"
            disabled={saving || !professionId}
            onClick={() => void saveMapping()}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save mapping"}
          </button>
        </div>
      </div>
    </div>
  );
}
