"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import BrandingColorField from "@/app/tenant-onboarding/BrandingColorField";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import HireJourneyPreview from "@/app/admin_recruiter/settings/HireJourneyPreview";
import {
  EFFECTIVE_BRANDING_QUERY_KEY,
  patchHireJourneyThemeCache,
} from "@/lib/admin/hooks/use-effective-branding";
import { notifyBrandingUpdated } from "@/lib/tenant/branding-events";
import {
  EMPTY_HIRE_JOURNEY_THEME,
  parseHireJourneyTheme,
  resolveHireJourneyTheme,
  type HireJourneyThemeOverrides,
  type ResolvedHireJourneyTheme,
} from "@/lib/tenant/hire-journey-theme";

const COMPLETION_GREEN = "#12AA00";

const FIELDS: Array<{
  key: keyof HireJourneyThemeOverrides;
  label: string;
  help: string;
  fallback: "primary" | "secondary" | "white" | "green" | "border";
}> = [
  {
    key: "progressBackgroundColor",
    label: "Progress background",
    help: "Light background of the current stage card. Starts as branding primary.",
    fallback: "primary",
  },
  {
    key: "stepperIconColor",
    label: "Stepper icon color",
    help: "Icons, labels, and lines in the top progress stepper. Starts as branding primary.",
    fallback: "primary",
  },
  {
    key: "stepIconColor",
    label: "Step icon color",
    help: "Fill of the icons inside a stage. Starts as branding secondary.",
    fallback: "secondary",
  },
  {
    key: "stepIconBorderColor",
    label: "Step icon border",
    help: "Border around the icons inside a stage. Starts as branding secondary.",
    fallback: "secondary",
  },
  {
    key: "completionIconColor",
    label: "Completion icon color",
    help: "Completed stage number and completion check. Starts as green.",
    fallback: "green",
  },
  {
    key: "completedStepBackground",
    label: "Completed step background",
    help: "Background of a finished stage and the finished step rows inside it. Starts as white.",
    fallback: "white",
  },
  {
    key: "stepBorderColor",
    label: "Step border color",
    help: "Border around each step row. Starts as light gray.",
    fallback: "border",
  },
  {
    key: "modalButtonColor",
    label: "Step modal buttons",
    help: "Buttons in the step window, including Add note. Starts as branding primary.",
    fallback: "primary",
  },
];

export default function HireJourneyThemePanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const branding = useTenantBranding();
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<HireJourneyThemeOverrides>(EMPTY_HIRE_JOURNEY_THEME);
  const [draft, setDraft] = useState<Record<keyof HireJourneyThemeOverrides, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(
    () => ({
      primary: branding.primaryHex,
      secondary: branding.secondaryHex,
      white: "#FFFFFF",
      green: COMPLETION_GREEN,
      border: "#E8ECF0",
    }),
    [branding.primaryHex, branding.secondaryHex]
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/hire-journey-theme")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { theme?: unknown } | null) => {
        if (cancelled || !payload) return;
        const theme = parseHireJourneyTheme(payload.theme);
        setOverrides(theme);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const resolved = resolveHireJourneyTheme(overrides, {
      primaryHex: defaults.primary,
      secondaryHex: defaults.secondary,
    });
    setDraft({
      progressBackgroundColor: resolved.progressBackgroundColor,
      stepperIconColor: resolved.stepperIconColor,
      stepIconColor: resolved.stepIconColor,
      stepIconBorderColor: resolved.stepIconBorderColor,
      completionIconColor: resolved.completionIconColor,
      completedStepBackground: resolved.completedStepBackground,
      stepBorderColor: resolved.stepBorderColor,
      modalButtonColor: resolved.modalButtonColor,
    });
  }, [defaults.primary, defaults.secondary, overrides]);

  const previewTheme = useMemo((): ResolvedHireJourneyTheme | null => {
    if (!draft) return null;
    return {
      progressBackgroundColor: draft.progressBackgroundColor,
      stepperIconColor: draft.stepperIconColor,
      stepIconColor: draft.stepIconColor,
      stepIconBorderColor: draft.stepIconBorderColor,
      completionIconColor: draft.completionIconColor,
      completedStepBackground: draft.completedStepBackground,
      stepBorderColor: draft.stepBorderColor,
      modalButtonColor: draft.modalButtonColor,
    };
  }, [draft]);

  async function save(reset = false) {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/hire-journey-theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reset
            ? { reset: true }
            : {
                ...draft,
                defaults: { primaryHex: defaults.primary, secondaryHex: defaults.secondary },
              }
        ),
      });
      const payload = (await response.json()) as { error?: string; theme?: unknown };
      if (!response.ok) throw new Error(payload.error || "Could not save hiring journey colors.");
      const nextTheme = parseHireJourneyTheme(payload.theme);
      setOverrides(nextTheme);
      patchHireJourneyThemeCache(queryClient, nextTheme);
      void queryClient.invalidateQueries({ queryKey: EFFECTIVE_BRANDING_QUERY_KEY });
      notifyBrandingUpdated();
      setMessage(reset ? "Hiring journey colors now follow branding again." : "Hiring journey colors saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save hiring journey colors.");
    } finally {
      setSaving(false);
    }
  }

  if (!draft || !previewTheme) return null;

  const fieldsGrid = (
    <div className={embedded ? "grid gap-4 sm:grid-cols-2" : "mt-5 grid gap-4 sm:grid-cols-2"}>
      {FIELDS.map((field) => (
        <div key={field.key}>
          <BrandingColorField
            label={field.label}
            value={draft[field.key]}
            defaultValue={defaults[field.fallback]}
            onChange={(value) => setDraft((current) => (current ? { ...current, [field.key]: value } : current))}
          />
          <p className="mt-1 text-xs leading-5 text-[#64748B]">{field.help}</p>
        </div>
      ))}
    </div>
  );

  const previewCard = (
    <aside className="flex w-full min-w-0 flex-col gap-3 self-start rounded-xl border border-[#E5E7EB] bg-white p-3.5 xl:sticky xl:top-4">
      <div className="flex items-start gap-2.5">
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#FBF8F2] p-2">
          <span className="flex size-5 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/settings-nav/preview-mark.svg" alt="" width={15.1667} height={15.1667} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5 text-black">Preview</p>
          <p className="text-[10px] leading-[15px] text-[#6B7280]">
            Live preview of pre-hire and post-hire journey colors.
          </p>
        </div>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1">
        <HireJourneyPreview theme={previewTheme} />
      </div>
    </aside>
  );

  const actions = (
    <div
      className={
        embedded
          ? "flex w-full flex-col-reverse gap-3 border-t border-[#E5E7EB] pt-6 sm:flex-row sm:items-center sm:justify-between"
          : "mt-5 flex flex-wrap items-center gap-3"
      }
    >
      {embedded ? (
        <div className="min-h-5">
          {message ? <p className="text-sm text-[#0F766E]">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {embedded ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const resolved = resolveHireJourneyTheme(overrides, {
                primaryHex: defaults.primary,
                secondaryHex: defaults.secondary,
              });
              setDraft({
                progressBackgroundColor: resolved.progressBackgroundColor,
                stepperIconColor: resolved.stepperIconColor,
                stepIconColor: resolved.stepIconColor,
                stepIconBorderColor: resolved.stepIconBorderColor,
                completionIconColor: resolved.completionIconColor,
                completedStepBackground: resolved.completedStepBackground,
                stepBorderColor: resolved.stepBorderColor,
                modalButtonColor: resolved.modalButtonColor,
              });
              setMessage(null);
              setError(null);
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-5 text-sm font-medium text-[#012352] disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(false)}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#012352] px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : embedded ? "Save Changes" : "Save hiring journey colors"}
        </button>
      </div>
      {!embedded ? (
        <>
          {message ? <p className="text-sm text-[#0F766E]">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </>
      ) : null}
    </div>
  );

  return (
    <section className={embedded ? "space-y-5" : "rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {embedded ? (
            <>
              <h3 className="text-sm font-semibold leading-5 text-black">Hiring Journey Colors</h3>
              <p className="mt-1 max-w-2xl text-[10px] leading-[15px] text-[#6B7280]">
                Colors for pre-hire and post-hire journey icons, progress, completed steps, and step modals.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-[Inter,sans-serif] text-lg font-semibold text-[#012352]">Hiring journey</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748B]">
                Colors for the pre-hire and post-hire journey, including icons, progress, completed steps, and the step
                window. Defaults match branding. Saving here does not change branding.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(true)}
          className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] disabled:opacity-60"
        >
          Use branding colors
        </button>
      </div>

      {embedded ? (
        <>
          <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
            <div className="min-w-0">{fieldsGrid}</div>
            {previewCard}
          </div>
          {actions}
        </>
      ) : (
        <>
          {fieldsGrid}
          {actions}
        </>
      )}
    </section>
  );
}
