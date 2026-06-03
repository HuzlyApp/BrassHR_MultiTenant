import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type AttendanceStatus = "clocked_in" | "clocked_out";
type AttendanceLog = {
  id: string;
  tenant_id: string;
  worker_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  clock_in_ip: string;
  clock_out_ip: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_location_timestamp: string;
  clock_out_location_timestamp: string | null;
};

type WorkerContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function parseStatus(value: string | null): AttendanceStatus | null {
  if (value === "clocked_in" || value === "clocked_out") return value;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const url = req.nextUrl;
    const workerIdRaw = url.searchParams.get("workerId")?.trim() ?? "";
    const date = url.searchParams.get("date")?.trim() ?? "";
    const status = parseStatus(url.searchParams.get("status"));
    const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

    let query = supabase
      .from("applicant_attendance_logs")
      .select("*")
      .order("clock_in_at", { ascending: false })
      .limit(200);

    if (scope.mode === "scoped") query = query.eq("tenant_id", scope.tenantId);
    if (workerIdRaw) {
      const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
      if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });
      query = query.eq("worker_id", idCheck.value);
    }
    if (date) query = query.eq("attendance_date", date);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const logs = (data as AttendanceLog[] | null) ?? [];
    const workerIds = Array.from(new Set(logs.map((log) => log.worker_id).filter(Boolean)));
    let workersById = new Map<string, WorkerContact>();
    if (workerIds.length > 0) {
      const { data: workers, error: workerError } = await supabase
        .from("worker")
        .select("id, first_name, last_name, email")
        .in("id", workerIds);
      if (workerError) throw workerError;
      workersById = new Map(
        ((workers as WorkerContact[] | null) ?? []).map((worker) => [worker.id, worker])
      );
    }

    const rows = logs
      .map((log) => {
        const worker = workersById.get(log.worker_id);
        const name = [worker?.first_name, worker?.last_name].filter(Boolean).join(" ").trim();
        return {
          ...log,
          applicant_name: name || "Applicant",
          applicant_email: worker?.email ?? null,
        };
      })
      .filter((row) => {
        if (!search) return true;
        return (
          row.applicant_name.toLowerCase().includes(search) ||
          (row.applicant_email ?? "").toLowerCase().includes(search)
        );
      });

    return NextResponse.json({ logs: rows });
  } catch (err) {
    console.error("[admin/applicant-attendance:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
