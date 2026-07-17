"use client";

import { useEffect, useState } from "react";
import { CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from "@/app/components/workflow-builder/constants";

export type FirmaTemplateOption = {
  id: string;
  name: string;
  firma_template_id: string | null;
};

type FirmaTemplateSelectProps = {
  value: string;
  templateName?: string;
  onChange: (next: { id: string; name: string }) => void;
  disabled?: boolean;
};

export function FirmaTemplateSelect({
  value,
  templateName,
  onChange,
  disabled = false,
}: FirmaTemplateSelectProps) {
  const [options, setOptions] = useState<FirmaTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/onboarding-builder/firma-templates", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load Firma templates");
        if (cancelled) return;
        setOptions(Array.isArray(data.templates) ? data.templates : []);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load Firma templates");
        setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div data-testid="firma-template-select">
      <label
        className="mb-1.5 block text-xs font-medium leading-4"
        style={{ color: TEXT_SECONDARY }}
      >
        Firma template
      </label>
      <select
        data-testid="firma-template-select-input"
        value={value}
        disabled={disabled || loading}
        onChange={(event) => {
          const id = event.target.value;
          const selected = options.find((option) => option.id === id);
          onChange({ id, name: selected?.name ?? "" });
        }}
        className="h-10 w-full appearance-none rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
      >
        <option value="">{loading ? "Loading templates..." : "Select a published Firma template"}</option>
        {value && templateName && !options.some((option) => option.id === value) ? (
          <option value={value}>{templateName}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1.5 text-[11px] leading-4 text-red-600" data-testid="firma-template-select-error">
          {error}
        </p>
      ) : !loading && options.length === 0 ? (
        <p className="mt-1.5 text-[11px] leading-4" style={{ color: TEXT_SECONDARY }}>
          No published Firma templates yet.{" "}
          <a
            href="/admin_recruiter/template-builder/new"
            className="font-medium underline underline-offset-2"
            style={{ color: "#BC8B41" }}
          >
            Create one in Template Builder
          </a>
          , publish it, then select it here.
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] leading-4" style={{ color: TEXT_SECONDARY }}>
          Applicants will sign this template inside onboarding using Firma embedded signing.
        </p>
      )}
    </div>
  );
}
