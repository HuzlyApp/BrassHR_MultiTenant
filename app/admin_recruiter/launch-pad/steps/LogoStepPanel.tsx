"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type DragEvent } from "react";
import toast from "react-hot-toast";
import { BRAAS_PLATFORM_FAVICON } from "@/lib/tenant/tenant-branding";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

type LogoTab = "logo" | "favicon";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isAllowedImage(file: File): boolean {
  const type = file.type.toLowerCase();
  return type === "image/png" || type === "image/jpeg" || type === "image/jpg";
}

export function LogoStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [tab, setTab] = useState<LogoTab>("logo");
  const [logoName, setLogoName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [savedLogoUrl, setSavedLogoUrl] = useState("");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState("");
  const [savedFaviconUrl, setSavedFaviconUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/branding", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          branding?: {
            logoUrl?: string | null;
            faviconUrl?: string | null;
            headline?: string | null;
            subtitle?: string | null;
            companyName?: string | null;
          };
        };
        if (!response.ok || cancelled) return;
        const branding = payload.branding;
        if (!branding) return;
        const logoUrl = String(branding.logoUrl ?? "").trim();
        const faviconUrl = String(branding.faviconUrl ?? "").trim();
        if (logoUrl) {
          setSavedLogoUrl(logoUrl);
          setLogoPreview(logoUrl);
        }
        // Only hydrate a real tenant favicon — never mirror logo or platform default.
        const isPlatformFavicon =
          faviconUrl === BRAAS_PLATFORM_FAVICON ||
          faviconUrl.endsWith("brassHR favicon 2.svg");
        if (faviconUrl && faviconUrl !== logoUrl && !isPlatformFavicon) {
          setSavedFaviconUrl(faviconUrl);
          setFaviconPreview(faviconUrl);
        }
        if (branding.headline?.trim() && branding.headline.trim() !== `Welcome to ${branding.companyName ?? ""}`.trim()) {
          setLogoName(branding.headline.trim());
        }
        if (branding.subtitle?.trim()) setTagline(branding.subtitle.trim());
      } catch {
        // Keep empty local state if branding cannot be loaded.
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFile = tab === "logo" ? logoFile : faviconFile;
  const activePreview = tab === "logo" ? logoPreview : faviconPreview;
  const hasSavedActive = tab === "logo" ? Boolean(savedLogoUrl) : Boolean(savedFaviconUrl);

  const applyFile = (file: File | null) => {
    if (!file) return;
    if (!isAllowedImage(file)) {
      setError("Only support png, jpg files");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2 MB files are allowed");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    if (tab === "logo") {
      setLogoFile(file);
      setLogoPreview(url);
    } else {
      setFaviconFile(file);
      setFaviconPreview(url);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    applyFile(event.dataTransfer.files?.[0] ?? null);
  };

  const clearActive = () => {
    if (tab === "logo") {
      setLogoFile(null);
      setLogoPreview(savedLogoUrl);
    } else {
      setFaviconFile(null);
      setFaviconPreview(savedFaviconUrl);
    }
  };

  const handleContinue = async () => {
    const hasAnyUpload = Boolean(logoFile || faviconFile);
    const hasAnySaved = Boolean(savedLogoUrl || savedFaviconUrl);
    const hasText = Boolean(logoName.trim() || tagline.trim());
    if (!hasAnyUpload && !hasAnySaved && !hasText) {
      setError("Upload a logo or favicon, or use Skip to continue without one.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      if (logoFile) {
        const form = new FormData();
        form.append("field", "logo");
        form.append("file", logoFile);
        const response = await fetch("/api/admin/branding/logo", { method: "POST", body: form });
        const data = (await response.json().catch(() => ({}))) as { error?: string; logoUrl?: string };
        if (!response.ok) throw new Error(data.error || "Could not upload your logo.");
        if (data.logoUrl) {
          setSavedLogoUrl(data.logoUrl);
          setLogoPreview(data.logoUrl);
          setLogoFile(null);
          uploaded.push("logo");
        }
      }
      if (faviconFile) {
        const form = new FormData();
        form.append("field", "favicon");
        form.append("file", faviconFile);
        const response = await fetch("/api/admin/branding/logo", { method: "POST", body: form });
        const data = (await response.json().catch(() => ({}))) as { error?: string; logoUrl?: string };
        if (!response.ok) throw new Error(data.error || "Could not upload your favicon.");
        if (data.logoUrl) {
          setSavedFaviconUrl(data.logoUrl);
          setFaviconPreview(data.logoUrl);
          setFaviconFile(null);
          uploaded.push("favicon");
        }
      }
      if (logoName.trim() || tagline.trim()) {
        const response = await fetch("/api/admin/branding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            welcomeHeadline: logoName.trim() || undefined,
            welcomeSubtitle: tagline.trim() || undefined,
          }),
        });
        if (!response.ok) throw new Error("Could not save your company branding.");
      }
      if (uploaded.includes("logo") && uploaded.includes("favicon")) {
        toast.success("Logo and favicon uploaded successfully.");
      } else if (uploaded.includes("logo")) {
        toast.success("Logo uploaded successfully.");
      } else if (uploaded.includes("favicon")) {
        toast.success("Favicon uploaded successfully.");
      } else if (hasAnyUpload) {
        toast.success("Branding images saved.");
      } else {
        toast.success("Branding details saved.");
      }
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your company branding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-[20px] py-8">
      <div className="flex items-center justify-center">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setTab("logo")}
            className={`px-3.5 py-3 text-[12px] leading-4 ${
              tab === "logo"
                ? "border-b-[1.5px] border-[#BC8B41] text-[#BC8B41]"
                : "text-[#374151]"
            }`}
            style={interStyle}
          >
            Company Logo
          </button>
          <button
            type="button"
            onClick={() => setTab("favicon")}
            className={`px-3.5 py-3 text-[12px] leading-4 ${
              tab === "favicon"
                ? "border-b-[1.5px] border-[#BC8B41] text-[#BC8B41]"
                : "text-[#374151]"
            }`}
            style={interStyle}
          >
            Favicon
          </button>
        </div>
      </div>

      <div className="w-full max-w-[620px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5 pt-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              {tab === "logo" ? "Add Company Logo" : "Add Favicon Icon"}
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              {tab === "logo"
                ? "Customize your company logo."
                : "Upload a square icon for browser tabs. This is separate from your company logo."}
            </p>
          </div>

          {tab === "logo" ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
                  Logo Name
                </span>
                <input
                  value={logoName}
                  onChange={(e) => setLogoName(e.target.value)}
                  placeholder="Logo name"
                  className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] text-black outline-none placeholder:text-[#9CA3AF] focus:border-[#012352]"
                  style={interStyle}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
                  Tagline
                </span>
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Tagline"
                  className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] text-black outline-none placeholder:text-[#9CA3AF] focus:border-[#012352]"
                  style={interStyle}
                />
              </label>
            </>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex flex-col items-center rounded-xl border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-5 py-5"
            >
              <Image
                src="/icons/braas-HR/launch-pad/upload.svg"
                alt=""
                width={36}
                height={36}
                className="size-9"
              />
              <p
                className="mt-3 text-center text-[12px] font-normal leading-4 text-[#374151]"
                style={interStyle}
              >
                Drag your file(s) to start uploading
              </p>
              <div className="my-2 flex w-full max-w-[377px] items-center gap-1 px-1">
                <span className="h-px flex-1 bg-[#E5E7EB]" />
                <span className="text-[10px] font-semibold text-black" style={interStyle}>
                  OR
                </span>
                <span className="h-px flex-1 bg-[#E5E7EB]" />
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-[30px] items-center justify-center rounded-lg border border-[#012352] bg-white px-2.5 text-[10px] font-semibold leading-[15px] text-[#012352]"
                style={interStyle}
              >
                Browse files
              </button>
              <p
                className="mt-3 w-full text-center text-[10px] font-normal leading-[15px] text-[#6B7280]"
                style={interStyle}
              >
                Max 2 MB files are allowed
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <p className="text-[12px] font-normal leading-5 text-[#6B7280]" style={interStyle}>
              Only support png, jpg files
            </p>
            {error ? (
              <p className="text-[12px] font-normal leading-4 text-[#DC2626]" style={interStyle}>
                {error}
              </p>
            ) : null}
            {loadingSaved ? (
              <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
                Loading saved branding…
              </p>
            ) : null}
          </div>

          {activePreview ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white p-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePreview}
                alt=""
                width={30}
                height={30}
                className="size-[30px] rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-normal leading-4 text-black" style={interStyle}>
                  {activeFile?.name || (tab === "logo" ? "Saved company logo" : "Saved favicon")}
                </p>
                <p className="text-[10px] font-normal leading-[15px] text-[#6B7280]" style={interStyle}>
                  {activeFile ? formatBytes(activeFile.size) : hasSavedActive ? "Saved" : "Selected"}
                </p>
              </div>
              {activeFile ? (
                <button type="button" onClick={clearActive} aria-label="Remove file">
                  <Image
                    src="/icons/braas-HR/launch-pad/delete-outline.svg"
                    alt=""
                    width={18}
                    height={18}
                    className="size-[18px]"
                  />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

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
