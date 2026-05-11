import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createClient } from "@/lib/supabase/server";

/** Staff list tenants (minimal fields) for selectors; restricted to god admin for cross-tenant view. */
export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!auth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to load tenants",
        detail: error.message,
        ...(process.env.NODE_ENV !== "production"
          ? { debug: { code: error.code, details: error.details, hint: error.hint } }
          : {}),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    tenants: data ?? [],
  });
}
