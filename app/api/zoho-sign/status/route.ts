import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchZohoRequestJson, mapZohoRequestStatusToDb } from "@/lib/zoho-sign-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("request_id")?.trim() || "";
    const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() || "";
    const reconcile =
      req.nextUrl.searchParams.get("reconcile") === "1" ||
      req.nextUrl.searchParams.get("reconcile") === "true";

    if (!requestId && !email) {
      return NextResponse.json(
        { success: false, error: "Provide request_id or email" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Missing server-side Supabase service role configuration" },
        { status: 500 },
      );
    }

    let query = supabase
      .from("zoho_sign_requests")
      .select("request_id,email,recipient_name,status,created_at,updated_at,zoho_document_id")
      .order("updated_at", { ascending: false })
      .limit(1);

    query = requestId ? query.eq("request_id", requestId) : query.eq("email", email);

    const { data, error } = await query.maybeSingle();
    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to query zoho_sign_requests", details: error.message },
        { status: 500 },
      );
    }

    let row = data || null;
    const ridForZoho = (requestId || row?.request_id || "").trim();

    if (reconcile && ridForZoho) {
      try {
        const { request_status } = await fetchZohoRequestJson(ridForZoho);
        const mapped = mapZohoRequestStatusToDb(request_status);
        if (mapped) {
          const rank = (s: string) =>
            ({ sent: 1, viewed: 2, signed: 3, completed: 4, declined: 4 } as Record<string, number>)[s] || 0;
          const cur = row?.status || "sent";
          const shouldWrite = rank(mapped) >= rank(cur);
          if (shouldWrite) {
            const { error: upErr } = await supabase
              .from("zoho_sign_requests")
              .update({ status: mapped, updated_at: new Date().toISOString() })
              .eq("request_id", ridForZoho);
            if (!upErr) {
              const { data: refreshed } = await supabase
                .from("zoho_sign_requests")
                .select("request_id,email,recipient_name,status,created_at,updated_at,zoho_document_id")
                .eq("request_id", ridForZoho)
                .maybeSingle();
              if (refreshed) row = refreshed;
            }
          }
        }
      } catch {
        // Reconciliation is best-effort; still return DB row.
      }
    }

    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected status endpoint error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
