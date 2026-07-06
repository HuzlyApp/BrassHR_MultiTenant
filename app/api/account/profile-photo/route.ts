import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveStaffProfilePhotoUrl, validateStaffProfilePhoto } from "@/lib/account/staff-profile-photo";
import { uploadStaffProfilePhoto } from "@/lib/account/staff-profile-photo-server";
import { formatApiError } from "@/lib/api/format-api-error";

export const runtime = "nodejs";

async function loadProfilePhotoPath(userId: string): Promise<string | null> {
  const svc = createServiceRoleClient();
  if (!svc) return null;

  const { data, error } = await svc
    .from("users")
    .select("profile_photo")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[account/profile-photo:get] users.profile_photo", error.message);
    return null;
  }

  const stored = typeof data?.profile_photo === "string" ? data.profile_photo.trim() : "";
  return stored || null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stored = await loadProfilePhotoPath(user.id);
    const profilePhotoUrl = stored ? await resolveStaffProfilePhotoUrl(supabase, stored) : null;

    return NextResponse.json({ profilePhotoUrl });
  } catch (err) {
    console.error("[account/profile-photo:get]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please choose a photo." }, { status: 400 });
    }

    const validationError = validateStaffProfilePhoto(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const svc = createServiceRoleClient();
    if (!svc) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const { storagePath, signedUrl } = await uploadStaffProfilePhoto(svc, file, user.id);

    const { error: updateError } = await svc
      .from("users")
      .update({
        profile_photo: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    const profilePhotoUrl =
      signedUrl ?? (await resolveStaffProfilePhotoUrl(supabase, storagePath));

    return NextResponse.json({
      ok: true,
      profilePhotoUrl,
      profilePhotoPath: storagePath,
    });
  } catch (err) {
    console.error("[account/profile-photo:post]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
