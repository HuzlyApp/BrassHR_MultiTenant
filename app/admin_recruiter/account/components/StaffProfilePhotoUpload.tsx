"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { ACCOUNT_DATA_QUERY_KEY } from "@/lib/account/hooks/use-account-data-query";
import { useQueryClient } from "@tanstack/react-query";

type StaffProfilePhotoUploadProps = {
  displayName: string;
  photoUrl: string | null;
  onPhotoUpdated?: (url: string | null) => void;
  variant?: "card" | "form";
};

export function StaffProfilePhotoUpload({
  displayName,
  photoUrl,
  onPhotoUpdated,
  variant = "form",
}: StaffProfilePhotoUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl);
  const [selectedFileName, setSelectedFileName] = useState("");
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
    setSelectedFileName(file.name);

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/account/profile-photo", {
        method: "POST",
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
      await queryClient.invalidateQueries({ queryKey: ACCOUNT_DATA_QUERY_KEY });
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

  if (variant === "card") {
    return (
      <div className="flex shrink-0 flex-col items-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="group relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] transition hover:ring-2 hover:ring-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-70"
          aria-label={previewUrl ? "Change photo" : "Add photo"}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-8 w-8 text-[#CBD5E1]" strokeWidth={1.25} aria-hidden />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            ) : (
              <span className="text-[11px] font-semibold text-white">Photo</span>
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
        <p className="mt-2 text-center text-xs font-medium text-[#64748B]">Tap to change</p>
        {uploadError ? <p className="mt-1 max-w-[120px] text-center text-xs text-red-600">{uploadError}</p> : null}
        {uploadSuccess ? <p className="mt-1 text-center text-xs font-medium text-emerald-600">Photo saved</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-medium text-[#374151]">Profile photo</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]">
          {previewUrl ? (
            <img src={previewUrl} alt="" width={56} height={56} className="h-14 w-14 object-cover" />
          ) : (
            <ImageIcon className="h-7 w-7 text-[#CBD5E1]" strokeWidth={1.25} aria-hidden />
          )}
        </div>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <span className="inline-flex h-10 shrink-0 items-center rounded-md border border-[#D1D5DB] bg-white px-4 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]">
            Choose photo
          </span>
          <span className="truncate text-sm text-[#6B7280]">
            {uploading ? "Uploading..." : selectedFileName || "JPG or PNG"}
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
        {uploading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#6B7280]" aria-hidden /> : null}
      </div>
      {uploadError ? <p className="mt-1.5 text-sm text-red-600">{uploadError}</p> : null}
      {uploadSuccess ? <p className="mt-1.5 text-sm font-medium text-emerald-600">Photo saved</p> : null}
      <p className="mt-1 text-xs text-[#9CA3AF]">Shows in header and sidebar for {displayName || "your account"}.</p>
    </div>
  );
}
