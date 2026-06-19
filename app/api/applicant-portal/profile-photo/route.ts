import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSignedPortalFileUrl,
  uploadApplicantPortalFile,
  validatePortalUploadFile,
} from "@/lib/applicant-portal/upload";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";

export const runtime = "nodejs";

const PROFILE_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/jpg", "image/webp"]);

function validateProfilePhoto(file: File): string | null {
  const baseError = validatePortalUploadFile(file);
  if (baseError) return baseError;
  const mime = (file.type || "").toLowerCase();
  if (mime && !PROFILE_PHOTO_MIME.has(mime)) {
    return "Please upload a JPG or PNG photo.";
  }
  return null;
}

async function resolveWorkerProfilePhotoUrl(
  supabase: SupabaseClient,
  workerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("worker")
    .select("profile_photo")
    .eq("id", workerId)
    .maybeSingle();

  if (error) {
    console.warn("[applicant-portal/profile-photo:get] worker profile_photo", error.message);
    return null;
  }

  const stored = typeof data?.profile_photo === "string" ? data.profile_photo.trim() : "";
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  return createSignedPortalFileUrl(supabase, stored);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const profilePhotoUrl = await resolveWorkerProfilePhotoUrl(auth.supabase, auth.applicant.id);
    return NextResponse.json({ profilePhotoUrl });
  } catch (err) {
    console.error("[applicant-portal/profile-photo:get]", err);
    const message = err instanceof Error ? err.message : "Could not load profile photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please choose a photo." }, { status: 400 });
    }

    const validationError = validateProfilePhoto(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { storagePath } = await uploadApplicantPortalFile(
      auth.supabase,
      file,
      auth.applicant.id,
      "profile-photo"
    );

    const { error: updateError } = await auth.supabase
      .from("worker")
      .update({
        profile_photo: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.applicant.id);

    if (updateError) throw updateError;

    const profilePhotoUrl = await createSignedPortalFileUrl(auth.supabase, storagePath);

    return NextResponse.json({
      ok: true,
      profilePhotoUrl,
      profilePhotoPath: storagePath,
    });
  } catch (err) {
    console.error("[applicant-portal/profile-photo:post]", err);
    const message = err instanceof Error ? err.message : "Could not upload photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
