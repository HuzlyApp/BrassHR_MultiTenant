import { NextRequest, NextResponse } from "next/server";
import {
  employmentWorkerTabLabel,
  parseEmploymentWorkerTab,
  type EmploymentWorkerRecord,
} from "@/lib/admin/employment-workers";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const SELECT_COLUMNS =
  "id, candidate_id, tenant_id, first_name, last_name, email, phone, worker_type, employment_classification, created_at, converted_at";

const SELECT_COLUMNS_WITH_LIST_FIELDS = `${SELECT_COLUMNS}, job_role, location, status`;

type WorkerListRow = EmploymentWorkerRecord & {
  worker?: {
    job_role: string | null;
    city: string | null;
    state: string | null;
    status: string | null;
  } | null;
};

function isMissingListColumnsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: string }).code) : "";
  const message = "message" in err ? String((err as { message?: string }).message) : "";
  return code === "42703" && /workers\.(job_role|location|status)/i.test(message);
}

function normalizeWorkerRow(row: WorkerListRow): EmploymentWorkerRecord {
  const candidate = row.worker;
  const locationFromCandidate = [candidate?.city?.trim(), candidate?.state?.trim()]
    .filter(Boolean)
    .join(", ");

  return {
    id: row.id,
    candidate_id: row.candidate_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    job_role: row.job_role ?? candidate?.job_role ?? null,
    location: row.location?.trim() || locationFromCandidate || null,
    status: row.status ?? candidate?.status ?? "active",
    worker_type: row.worker_type,
    employment_classification: row.employment_classification,
    created_at: row.created_at,
    converted_at: row.converted_at,
  };
}

async function fetchEmploymentWorkers(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  tab: ReturnType<typeof parseEmploymentWorkerTab>,
  tenantId: string | null
) {
  const buildQuery = (select: string, applyTabFilter = true) => {
    let query = supabase.from("workers").select(select).order("created_at", { ascending: false });
    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (applyTabFilter) {
      switch (tab) {
        case "new":
          query = query.eq("status", "new");
          break;
        case "w2":
          query = query.eq("worker_type", "w2");
          break;
        case "1099":
          query = query.eq("worker_type", "1099");
          break;
        default:
          break;
      }
    }
    return query;
  };

  const primary = await buildQuery(SELECT_COLUMNS_WITH_LIST_FIELDS);
  if (!primary.error) {
    return (primary.data ?? []).map((row) =>
      normalizeWorkerRow(row as unknown as WorkerListRow)
    );
  }
  if (!isMissingListColumnsError(primary.error)) throw primary.error;

  const fallbackSelect =
    `${SELECT_COLUMNS}, worker:candidate_id ( job_role, city, state, status )`;
  const fallback = await buildQuery(fallbackSelect, tab !== "new");
  if (fallback.error) throw fallback.error;

  let rows = (fallback.data ?? []) as unknown as WorkerListRow[];
  if (tab === "new") {
    rows = rows.filter((row) => (row.worker?.status ?? "").trim().toLowerCase() === "new");
  }

  return rows.map(normalizeWorkerRow);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tab = parseEmploymentWorkerTab(req.nextUrl.searchParams.get("tab"));
    const tenantScope = await resolveStaffTenantScope(auth.authUser);
    const tenantId = tenantScope.mode === "scoped" ? tenantScope.tenantId : null;

    const workers = await fetchEmploymentWorkers(supabase, tab, tenantId);

    return NextResponse.json({
      tab,
      tabLabel: employmentWorkerTabLabel(tab),
      total: workers.length,
      workers,
    });
  } catch (err: unknown) {
    console.error("[admin/employment-workers]", err);
    const message = err instanceof Error ? err.message : "Failed to load workers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
