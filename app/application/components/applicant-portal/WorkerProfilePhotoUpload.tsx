"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useApplicantPortal } from "./ApplicantPortalProvider";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

type WorkerProfilePhotoUploadProps = {
  displayName: string;
  photoUrl: string | null;
  onPhotoUpdated?: (url: string | null) => void;
  variant?: "avatar" | "form";
};

export function WorkerProfilePhotoUpload({
  displayName,
  photoUrl,
  onPhotoUpdated,
  variant = "form",
}: WorkerProfilePhotoUploadProps) {
  const { authHeaders, setProfilePhotoUrl } = useApplicantPortal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    setPreviewUrl(photoUrl);
  }, [photoUrl]);

  async function handlePhotoSelected(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Please sign in again.");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/applicant-portal/profile-photo", {
        method: "POST",
        headers,
        body: formData,
      });
      const payload = (await res.json().catch(() => ({}))) as {
        profilePhotoUrl?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not upload photo.");

      const nextUrl = payload.profilePhotoUrl ?? null;
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(nextUrl);
      onPhotoUpdated?.(nextUrl);
      setProfilePhotoUrl(nextUrl);
      setUploadSuccess(true);
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(photoUrl);
      setUploadError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (variant === "avatar") {
    return (
      <div className="flex w-[96px] shrink-0 flex-col items-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="group relative flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-full bg-[#E5E7EB] text-[28px] font-semibold text-[#4B5563] ring-0 transition hover:ring-2 hover:ring-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-70"
          aria-label={previewUrl ? "Change photo" : "Add photo"}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(displayName)
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            ) : (
              <span className="text-[10px] font-semibold text-white">Photo</span>
            )}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => void handlePhotoSelected(event.target.files?.[0])}
        />
        <p className="mt-3 text-center text-[11px] font-medium leading-4 text-[#6B7280]">Tap to change</p>
        {uploadError ? (
          <p className="mt-1 max-w-[96px] text-center text-[11px] leading-4 text-red-600">{uploadError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Profile photo</label>
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#E5E7EB] bg-[#F3F4F6]">
          {previewUrl ? (
            <img src={previewUrl} alt="" width={24} height={24} className="h-6 w-6 object-cover" />
          ) : (
            <span className="text-[8px] font-semibold leading-none text-[#9CA3AF]">
              {initials(displayName).slice(0, 2)}
            </span>
          )}
        </div>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-[#D1D5DB] bg-white px-3 text-xs font-semibold text-[#111827] hover:bg-[#F9FAFB]">
            Choose file
          </span>
          <span className="truncate text-xs text-[#9CA3AF]">
            {uploading ? "Uploading..." : uploadSuccess ? "Saved" : "JPG or PNG"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => void handlePhotoSelected(event.target.files?.[0])}
          />
        </label>
        {uploading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#6B7280]" aria-hidden /> : null}
      </div>
      {uploadError ? <p className="mt-1 text-xs text-red-600">{uploadError}</p> : null}
      {uploadSuccess ? <p className="mt-1 text-xs font-medium text-emerald-600">Photo saved</p> : null}
    </div>
  );
}
