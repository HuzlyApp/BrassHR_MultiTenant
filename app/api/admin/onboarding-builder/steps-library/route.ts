import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { WORKFLOW_STEP_LIBRARY_DATA } from "@/lib/onboarding/workflow-step-library-data";

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    categories: WORKFLOW_STEP_LIBRARY_DATA,
  });
}
