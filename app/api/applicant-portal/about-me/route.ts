import { NextRequest, NextResponse } from "next/server";
import { formatApiError } from "@/lib/api/format-api-error";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";

export const runtime = "nodejs";

const ABOUT_ME_MAX_LENGTH = 1000;

export function normalizeAboutMe(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, ABOUT_ME_MAX_LENGTH);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await auth.supabase
      .from("worker")
      .select("about_me")
      .eq("id", auth.applicant.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      aboutMe: typeof data?.about_me === "string" ? data.about_me : "",
    });
  } catch (err) {
    console.error("[applicant-portal/about-me GET]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as { aboutMe?: unknown };
    if (typeof body.aboutMe !== "string") {
      return NextResponse.json({ error: "About Me text is required." }, { status: 400 });
    }

    const raw = body.aboutMe.trim();
    if (raw.length > ABOUT_ME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `About Me must be ${ABOUT_ME_MAX_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }

    const aboutMe = normalizeAboutMe(body.aboutMe);

    const { data, error } = await auth.supabase
      .from("worker")
      .update({
        about_me: aboutMe,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.applicant.id)
      .select("about_me")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      aboutMe: typeof data?.about_me === "string" ? data.about_me : "",
    });
  } catch (err) {
    console.error("[applicant-portal/about-me PATCH]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
