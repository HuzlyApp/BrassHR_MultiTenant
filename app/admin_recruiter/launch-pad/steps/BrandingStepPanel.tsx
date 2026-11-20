"use client";

import { useState } from "react";
import { BRAND_COLOR_PRESETS } from "@/app/tenant-onboarding/constants";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

export function BrandingStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [presetIndex, setPresetIndex] = useState(0);
  const [primary, setPrimary] = useState<string>(BRAND_COLOR_PRESETS[0].primary);
  const [secondary, setSecondary] = useState<string>(BRAND_COLOR_PRESETS[0].secondary);
  const [accent, setAccent] = useState<string>(BRAND_COLOR_PRESETS[0].accent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyPreset = (index: number) => {
    const preset = BRAND_COLOR_PRESETS[index];
    setPresetIndex(index);
    setPrimary(preset.primary);
    setSecondary(preset.secondary);
    setAccent(preset.accent);
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
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save your branding.");
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your branding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[620px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              Customize your Branding
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              Colors, font, welcome headline.
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
                  className={`flex flex-col gap-2 rounded-xl border p-3.5 text-left ${
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

          <div className="flex flex-col gap-3.5">
            <p className="text-[14px] font-semibold leading-5 text-black" style={interStyle}>
              Custom Colors
            </p>
            {(
              [
                { label: "Primary color", value: primary, set: setPrimary },
                { label: "Second color", value: secondary, set: setSecondary },
                { label: "Accent color", value: accent, set: setAccent },
              ] as const
            ).map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-3.5 py-3.5"
              >
                <label className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={row.value}
                    onChange={(e) => {
                      setPresetIndex(-1);
                      row.set(e.target.value);
                    }}
                    className="size-9 cursor-pointer overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-0"
                  />
                  <span className="text-[12px] font-normal text-[#6B7280]" style={interStyle}>
                    {row.value.toUpperCase()}
                  </span>
                </label>
                <span className="text-[12px] font-normal text-black" style={interStyle}>
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error ? <p role="alert" className="px-5 pb-4 text-sm text-red-600">{error}</p> : null}
        <div className="border-t border-[#E5E7EB]">
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
