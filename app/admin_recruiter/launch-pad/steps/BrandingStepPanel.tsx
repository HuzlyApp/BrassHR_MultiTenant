"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import BrandingColorField from "@/app/tenant-onboarding/BrandingColorField";
import { BRAND_COLOR_PRESETS } from "@/app/tenant-onboarding/constants";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

function normalizeHex(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  return withHash.toUpperCase();
}

function matchingPresetIndex(primary: string, secondary: string, accent: string): number {
  const p = normalizeHex(primary);
  const s = normalizeHex(secondary);
  const a = normalizeHex(accent);
  return BRAND_COLOR_PRESETS.findIndex(
    (preset) =>
      normalizeHex(preset.primary) === p &&
      normalizeHex(preset.secondary) === s &&
      normalizeHex(preset.accent) === a
  );
}

export function BrandingStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const defaultPreset = BRAND_COLOR_PRESETS[0];
  const [presetIndex, setPresetIndex] = useState(0);
  const [primary, setPrimary] = useState<string>(defaultPreset.primary);
  const [secondary, setSecondary] = useState<string>(defaultPreset.secondary);
  const [accent, setAccent] = useState<string>(defaultPreset.accent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/branding", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          branding?: {
            primaryHex?: string | null;
            secondaryHex?: string | null;
            accentHex?: string | null;
          };
        };
        if (!response.ok || cancelled || !payload.branding) return;
        const nextPrimary = normalizeHex(payload.branding.primaryHex) || defaultPreset.primary;
        const nextSecondary =
          normalizeHex(payload.branding.secondaryHex) || defaultPreset.secondary;
        const nextAccent = normalizeHex(payload.branding.accentHex) || defaultPreset.accent;
        setPrimary(nextPrimary);
        setSecondary(nextSecondary);
        setAccent(nextAccent);
        setPresetIndex(matchingPresetIndex(nextPrimary, nextSecondary, nextAccent));
      } catch {
        // Keep preset defaults if branding cannot be loaded.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultPreset.accent, defaultPreset.primary, defaultPreset.secondary]);

  const applyPreset = (index: number) => {
    const preset = BRAND_COLOR_PRESETS[index];
    setPresetIndex(index);
    setPrimary(preset.primary);
    setSecondary(preset.secondary);
    setAccent(preset.accent);
  };

  const handleColorChange = (field: "primary" | "secondary" | "accent", value: string) => {
    const nextPrimary = field === "primary" ? value : primary;
    const nextSecondary = field === "secondary" ? value : secondary;
    const nextAccent = field === "accent" ? value : accent;
    if (field === "primary") setPrimary(value);
    if (field === "secondary") setSecondary(value);
    if (field === "accent") setAccent(value);
    setPresetIndex(matchingPresetIndex(nextPrimary, nextSecondary, nextAccent));
  };

  const handleContinue = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save your branding.");
      toast.success("Branding colors saved successfully.");
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your branding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[620px] rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              Customize your Branding
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              Choose a preset or set custom brand colors.
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            <p className="text-[14px] font-semibold leading-5 text-black" style={interStyle}>
              Quick Presets
            </p>
            <div className="grid grid-cols-2 gap-5">
              {BRAND_COLOR_PRESETS.map((preset, index) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(index)}
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-left transition hover:bg-[#F8FAFC] ${
                    presetIndex === index
                      ? "border-[#012352] bg-[#FBF8F2]"
                      : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-6 rounded-full"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <span
                      className="size-6 rounded-full"
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <span
                      className="size-6 rounded-full"
                      style={{ backgroundColor: preset.accent }}
                    />
                  </span>
                  <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[14px] font-semibold leading-5 text-black" style={interStyle}>
                Custom Colors
              </p>
              <p className="mt-0.5 text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
                Click a color swatch to open the picker, then Save Changes in the popup.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <BrandingColorField
                label="Primary color"
                value={primary}
                defaultValue={defaultPreset.primary}
                onChange={(value) => handleColorChange("primary", value)}
              />
              <BrandingColorField
                label="Second color"
                value={secondary}
                defaultValue={defaultPreset.secondary}
                onChange={(value) => handleColorChange("secondary", value)}
              />
              <BrandingColorField
                label="Accent color"
                value={accent}
                defaultValue={defaultPreset.accent}
                onChange={(value) => handleColorChange("accent", value)}
              />
            </div>
          </div>
          {!hydrated ? (
            <p className="text-[12px] text-[#6B7280]" style={interStyle}>
              Loading saved branding…
            </p>
          ) : null}
        </div>

        {error ? <p role="alert" className="px-5 pb-4 text-sm text-red-600">{error}</p> : null}
        <div className="overflow-hidden rounded-b-xl border-t border-[#E5E7EB]">
          <LaunchPadStepActions
            onSkip={onSkip}
            onBack={onBack}
            onContinue={() => void handleContinue()}
            saving={saving}
          />
        </div>
      </div>
    </div>
  );
}
