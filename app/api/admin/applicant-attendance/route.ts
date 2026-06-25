import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  ATTENDANCE_BUCKETS,
  type AttendanceBucket,
  type AttendanceBucketCounts,
  parseAttendanceBucket,
} from "@/lib/attendance/attendance-buckets";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { resolveWorkerProfilePhotoUrl } from "@/lib/applicant-portal/worker-profile-photo";

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
  claimed_at?: string | null;
  claimed_by?: string | null;
};

type WorkerContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profile_photo?: string | null;
  profile_photo_url?: string | null;
};

type SharedFilterOptions = {
  scope: Awaited<ReturnType<typeof resolveStaffTenantScope>>;
  workerId?: string;
  date?: string;
};

type LogsQuery = ReturnType<SupabaseClient["from"]>;

async function supportsClaimTracking(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from("applicant_attendance_logs").select("claimed_at").limit(0);
  if (!error) return true;
  if (error.message.toLowerCase().includes("claimed_at")) return false;
  throw error;
}

function applySharedFilters(query: LogsQuery, options: SharedFilterOptions): LogsQuery {
  let next = query;
  if (options.scope.mode === "scoped") next = next.eq("tenant_id", options.scope.tenantId);
  if (options.workerId) next = next.eq("worker_id", options.workerId);
  if (options.date) next = next.eq("attendance_date", options.date);
  return next;
}

function applyBucketFilter(
  query: LogsQuery,
  bucket: AttendanceBucket,
  claimTrackingEnabled: boolean
): LogsQuery {
  switch (bucket) {
    case "ongoing":
      return query.eq("status", "clocked_in");
    case "completed":
      if (claimTrackingEnabled) {
        return query.eq("status", "clocked_out").not("claimed_at", "is", null);
      }
      return query.eq("id", "00000000-0000-0000-0000-000000000000");
    case "unclaimed":
      if (claimTrackingEnabled) {
        return query.eq("status", "clocked_out").is("claimed_at", null);
      }
      return query.eq("status", "clocked_out");
    default:
      return query;
  }
}

async function countForBucket(
  supabase: SupabaseClient,
  bucket: AttendanceBucket,
  options: SharedFilterOptions,
  claimTrackingEnabled: boolean
): Promise<number> {
  let query = supabase
    .from("applicant_attendance_logs")
    .select("id", { count: "exact", head: true });

  query = applySharedFilters(query, options);
  query = applyBucketFilter(query, bucket, claimTrackingEnabled);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function loadBucketCounts(
  supabase: SupabaseClient,
  options: SharedFilterOptions,
  claimTrackingEnabled: boolean
): Promise<AttendanceBucketCounts> {
  const entries = await Promise.all(
    ATTENDANCE_BUCKETS.map(
      async (bucket) =>
        [bucket, await countForBucket(supabase, bucket, options, claimTrackingEnabled)] as const
    )
  );
  return Object.fromEntries(entries) as AttendanceBucketCounts;
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

    const claimTrackingEnabled = await supportsClaimTracking(supabase);
    const url = req.nextUrl;
    const workerIdRaw = url.searchParams.get("workerId")?.trim() ?? "";
    const date = url.searchParams.get("date")?.trim() ?? "";
    const bucket = parseAttendanceBucket(url.searchParams.get("bucket"));
    const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

    let workerId: string | undefined;
    if (workerIdRaw) {
      const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
      if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });
      workerId = idCheck.value;
    }

    const sharedOptions: SharedFilterOptions = { scope, workerId, date: date || undefined };

    let query = supabase
      .from("applicant_attendance_logs")
      .select("*")
      .order("clock_in_at", { ascending: false })
      .limit(200);

    query = applySharedFilters(query, sharedOptions);
    query = applyBucketFilter(query, bucket, claimTrackingEnabled);

    const [{ data, error }, counts] = await Promise.all([
      query,
      loadBucketCounts(supabase, sharedOptions, claimTrackingEnabled),
    ]);
    if (error) throw error;

    const logs = (data as AttendanceLog[] | null) ?? [];
    const workerIds = Array.from(new Set(logs.map((log) => log.worker_id).filter(Boolean)));
    let workersById = new Map<string, WorkerContact>();
    if (workerIds.length > 0) {
      const { data: workers, error: workerError } = await supabase
        .from("worker")
        .select("id, first_name, last_name, email, profile_photo")
        .in("id", workerIds);
      if (workerError) throw workerError;
      workersById = new Map(
        await Promise.all(
          ((workers as WorkerContact[] | null) ?? []).map(async (worker) => {
            const profile_photo_url = await resolveWorkerProfilePhotoUrl(
              supabase,
              worker.profile_photo
            );
            return [worker.id, { ...worker, profile_photo_url }] as const;
          })
        )
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
          profile_photo_url: worker?.profile_photo_url ?? null,
        };
      })
      .filter((row) => {
        if (!search) return true;
        return (
          row.applicant_name.toLowerCase().includes(search) ||
          (row.applicant_email ?? "").toLowerCase().includes(search)
        );
      });

    return NextResponse.json({
      logs: rows,
      counts,
      bucket,
      claimTrackingEnabled,
    });
  } catch (err) {
    console.error("[admin/applicant-attendance:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const claimTrackingEnabled = await supportsClaimTracking(supabase);
    if (!claimTrackingEnabled) {
      return NextResponse.json(
        {
          error:
            "Claim tracking is not enabled yet. Run the attendance claim migration in Supabase SQL editor.",
        },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      action?: "claim";
    };

    if (body.action !== "claim") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const idCheck = parseRequiredUuid(body.id?.trim() ?? "", "id");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    let lookup = supabase
      .from("applicant_attendance_logs")
      .select("id, tenant_id, status, claimed_at")
      .eq("id", idCheck.value)
      .maybeSingle();

    if (scope.mode === "scoped") lookup = lookup.eq("tenant_id", scope.tenantId);

    const { data: existing, error: lookupError } = await lookup;
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
    if (existing.status !== "clocked_out") {
      return NextResponse.json({ error: "Only completed records can be claimed." }, { status: 409 });
    }
    if (existing.claimed_at) {
      return NextResponse.json({ error: "This record is already claimed." }, { status: 409 });
    }

    const claimedAt = new Date().toISOString();
    let update = supabase
      .from("applicant_attendance_logs")
      .update({
        claimed_at: claimedAt,
        claimed_by: auth.authUser.id,
        updated_at: claimedAt,
      })
      .eq("id", idCheck.value);

    if (scope.mode === "scoped") update = update.eq("tenant_id", scope.tenantId);

    const { error: updateError } = await update;
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, claimedAt });
  } catch (err) {
    console.error("[admin/applicant-attendance:patch]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
