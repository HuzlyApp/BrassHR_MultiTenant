"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { DEFAULT_ASSIGN_ONLY_MANAGER_HR } from "@/lib/tasks/assigner-roles";

function BrandToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[color:var(--brand-secondary)]" : "bg-[#CBD5E1]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function TaskSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [assignOnlyManagerHr, setAssignOnlyManagerHr] = useState(DEFAULT_ASSIGN_ONLY_MANAGER_HR);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/task-settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        canManage?: boolean;
        settings?: { assignOnlyManagerHr?: boolean };
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load task settings");
      }
      setCanManage(Boolean(payload.canManage));
      setAssignOnlyManagerHr(
        typeof payload.settings?.assignOnlyManagerHr === "boolean"
          ? payload.settings.assignOnlyManagerHr
          : DEFAULT_ASSIGN_ONLY_MANAGER_HR
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load task settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (next: boolean) => {
    if (!canManage || saving) return;
    const previous = assignOnlyManagerHr;
    setAssignOnlyManagerHr(next);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/task-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignOnlyManagerHr: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        settings?: { assignOnlyManagerHr?: boolean };
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save task settings");
      }
      if (typeof payload.settings?.assignOnlyManagerHr === "boolean") {
        setAssignOnlyManagerHr(payload.settings.assignOnlyManagerHr);
      }
      toast.success("Task settings saved");
    } catch (error) {
      setAssignOnlyManagerHr(previous);
      toast.error(error instanceof Error ? error.message : "Failed to save task settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading task settings</span>
        <div className="h-28 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5 text-[#0F172A]">
            Manager / HR assignment only
          </h3>
          <p className="mt-0.5 text-xs leading-[15px] text-[#6B7280]">
            When enabled, only Manager and HR roles can assign tasks to workers. Admins can always
            assign.
          </p>
        </div>
        <BrandToggle
          checked={assignOnlyManagerHr}
          onChange={onToggle}
          disabled={!canManage || saving}
          label="Manager / HR assignment only"
        />
      </div>
      {!canManage ? (
        <p className="mt-3 text-xs text-[#6B7280]">
          You can view this setting, but only Admin or HR can change it.
        </p>
      ) : null}
    </section>
  );
}
