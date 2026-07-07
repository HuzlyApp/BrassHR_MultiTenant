import { NextResponse } from "next/server";
import { ensureSupabaseBackendResolved } from "@/lib/supabase-env";
import { getResolvedBackendConfig } from "@/lib/supabase/backend-selection";

export const runtime = "nodejs";

/** Public runtime config for browser Supabase client (anon key only). */
export async function GET() {
  await ensureSupabaseBackendResolved();
  const config = getResolvedBackendConfig();
  if (!config) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  return NextResponse.json(
    {
      backend: config.id,
      url: config.url,
      anonKey: config.anonKey,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
