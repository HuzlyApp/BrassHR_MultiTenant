import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { isClaudeMatchAnalysisAvailable } from "@/lib/jobs/match-analysis";

export const runtime = "nodejs";

/**
 * Provider availability for the Match Analysis Model dropdown.
 * Never returns API keys — only boolean flags.
 */
export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    providers: {
      grok: true,
      gemini: true,
      claude: isClaudeMatchAnalysisAvailable(),
    },
    defaultProvider: "grok",
  });
}
