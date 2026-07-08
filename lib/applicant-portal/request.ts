import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  findApplicantByUserId,
  type ApplicantWorkerRow,
} from "@/lib/applicant-portal";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ApplicantPortalContext = {
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>;
  user: User;
  applicant: ApplicantWorkerRow;
};

export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function requireApprovedApplicant(
  req: NextRequest
): Promise<ApplicantPortalContext | NextResponse> {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applicant = await findApplicantByUserId(supabase, data.user.id);
  if (!applicant?.id) {
    return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  }

  return { supabase, user: data.user, applicant };
}
