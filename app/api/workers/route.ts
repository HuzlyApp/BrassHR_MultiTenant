import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { narrowWorkerRowsByTenant } from "@/lib/workers/tenant-query";

type WorkerStatus =
  | "new"
  | "pending"
  | "approved"
  | "disapproved"
  | "active"
  | "inactive"
  | "cancelled"
  | "banned";
type SbErr = { message: string; code?: string };
type ContactLookupRow = {
  id: string | null;
  email: string | null;
  phone: string | null;
};

function parseStatus(v: string | null): WorkerStatus | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (
    s === "new" ||
    s === "pending" ||
    s === "approved" ||
    s === "disapproved" ||
    s === "active" ||
    s === "inactive" ||
    s === "cancelled" ||
    s === "banned"
  ) {
    return s;
  }
  return null;
}

function statusVariants(s: WorkerStatus): string[] {
  // Text column `status` may store Title Case; match all casings.
  const title = s.slice(0, 1).toUpperCase() + s.slice(1);
  const upper = s.toUpperCase();
  return Array.from(new Set([s, title, upper]));
}

/** Enum `worker_status` only accepts declared labels (typically lowercase); never pass "New"/"NEW". */
function statusFilterValues(
  s: WorkerStatus,
  col: "worker_status" | "status"
): string[] {
  if (col === "worker_status") {
    return [s];
  }
  return statusVariants(s);
}

const PIPELINE_STATUSES = new Set<WorkerStatus>([
  "new",
  "pending",
  "approved",
  "disapproved",
]);

/** Prefer text `status` (recruiter pipeline); fall back to enum `worker_status`. */
function resolveWorkerDisplayStatus(row: Record<string, unknown>): string | null {
  const pipeline =
    typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  const legacy =
    typeof row.worker_status === "string"
      ? row.worker_status.trim().toLowerCase()
      : "";

  if (pipeline && PIPELINE_STATUSES.has(pipeline as WorkerStatus)) return pipeline;
  if (legacy && PIPELINE_STATUSES.has(legacy as WorkerStatus)) return legacy;
  if (pipeline) return pipeline;
  if (legacy) return legacy;
  return null;
}

export async function GET(req: Request) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;
    const tenantScope = await resolveStaffTenantScope(auth.authUser);

    const urlObj = new URL(req.url);
    const status = parseStatus(
      urlObj.searchParams.get("worker_status") ??
        urlObj.searchParams.get("status")
    );
    const headOnly = urlObj.searchParams.get("head") === "1";

    const url = getSupabaseUrl();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const anonKey = getSupabaseAnonKey();
    /** Prefer service role; fall back to anon if missing or rejected (e.g. wrong key in .env). */
    const keys = [serviceKey, anonKey].filter(
      (k): k is string => Boolean(k)
    );

    if (!url || keys.length === 0) {
      return Response.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );
    }

    let lastMessage = "Failed to load workers";

    const isMissingColumnErr = (e: unknown) => {
      const err = e as { code?: string; message?: string } | null;
      if (!err) return false;
      // Postgres undefined_column
      if (err.code === "42703") return true;
      return typeof err.message === "string" && err.message.includes(" does not exist");
    };

    for (const key of keys) {
      const supabase = createClient(url, key);
      const baseColsOptions =
        tenantScope.mode === "scoped"
          ? ([
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at, tenant_id",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, created_at, tenant_id",
            ] as const)
          : ([
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, created_at",
            ] as const);

      // Applicant pipeline statuses live in text column `status`. Some databases also have an
      // unrelated enum `worker_status`, which does not accept values like "approved".
      const pipelineStatus =
        status === "new" ||
        status === "pending" ||
        status === "approved" ||
        status === "disapproved";
      const attempts = pipelineStatus
        ? [
            { col: "status" as const, extra: "status" as const },
            { col: "worker_status" as const, extra: "worker_status" as const },
          ]
        : [
            // "All" must load pipeline `status` (where approvals are stored), not only `worker_status`.
            { col: "status" as const, extra: "status, worker_status" as const },
            { col: "worker_status" as const, extra: "worker_status" as const },
          ];

      let data: unknown[] | null = null;
      let error: SbErr | null = null;
      let count: number | null = null;

      outer: for (const baseCols of baseColsOptions) {
        for (const a of attempts) {
          const select = `${baseCols}, ${a.extra}`;

          if (status === "new") {
            const variants = statusFilterValues(status, a.col);
            const [rIn, rNull] = await Promise.all([
              headOnly
                ? supabase
                    .from("worker")
                    .select(select, { count: "exact", head: true })
                    .in(a.col, variants)
                : supabase
                    .from("worker")
                    .select(select)
                    .in(a.col, variants)
                    .order("created_at", { ascending: false }),
              headOnly
                ? supabase
                    .from("worker")
                    .select(select, { count: "exact", head: true })
                    .is(a.col, null)
                : supabase
                    .from("worker")
                    .select(select)
                    .is(a.col, null)
                    .order("created_at", { ascending: false }),
            ]);

            if (rIn.error || rNull.error) {
              const e = rIn.error ?? rNull.error!;
              error = {
                message: e.message || "Supabase query failed",
                code: (e as { code?: string }).code,
              };
              data = null;
              count = null;
              if (!isMissingColumnErr(error)) break outer;
              continue;
            }

            if (headOnly) {
              data = [];
              count = (rIn.count ?? 0) + (rNull.count ?? 0);
              error = null;
            } else {
              const map = new Map<string, unknown>();
              const combined = [
                ...((rIn.data as unknown[] | null) ?? []),
                ...((rNull.data as unknown[] | null) ?? []),
              ];
              for (const row of combined) {
                const rec = row as Record<string, unknown>;
                const id = rec.id != null ? String(rec.id) : "";
                if (!id) continue;
                if (!map.has(id)) map.set(id, row);
              }
              const merged = [...map.values()].sort((x, y) => {
                const ax = new Date(
                  String((x as { created_at?: string }).created_at ?? 0)
                ).getTime();
                const ay = new Date(
                  String((y as { created_at?: string }).created_at ?? 0)
                ).getTime();
                return ay - ax;
              });
              data = merged;
              count = merged.length;
              error = null;
            }
          } else {
            let q = supabase.from("worker").select(select, { count: "exact", head: headOnly });
            if (status) q = q.in(a.col, statusFilterValues(status, a.col));
            const res = await q.order("created_at", { ascending: false });
            data = (res.data as unknown[] | null) ?? null;
            error = res.error
              ? { message: res.error.message, code: (res.error as { code?: string }).code }
              : null;
            count = typeof res.count === "number" ? res.count : null;
          }

          if (!error) break outer;
          if (!isMissingColumnErr(error)) break outer;
        }
      }

      if (!error) {
        const normalized = (data ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          const s = resolveWorkerDisplayStatus(r);
          return { ...r, status: s };
        });

        const narrowed = await narrowWorkerRowsByTenant(
          supabase,
          tenantScope,
          normalized as Record<string, unknown>[]
        );

        const withContacts = async () => {
          if (headOnly) return [];
          const rows = narrowed as Array<Record<string, unknown>>;
          if (rows.length === 0) return [];

          const userIds = Array.from(
            new Set(
              rows
                .map((row) => (typeof row.user_id === "string" ? row.user_id : ""))
                .filter(Boolean)
            )
          );
          const workerIds = Array.from(
            new Set(
              rows
                .map((row) => (typeof row.id === "string" ? row.id : ""))
                .filter(Boolean)
            )
          );

          let usersById = new Map<string, ContactLookupRow>();
          if (userIds.length > 0) {
            const { data: usersData, error: usersError } = await supabase
              .from("users")
              .select("id, email, phone")
              .in("id", userIds);
            if (usersError) {
              console.warn("Failed to load users contact data:", usersError.message);
            } else {
              usersById = new Map(
                ((usersData as ContactLookupRow[] | null) ?? [])
                  .filter((u) => Boolean(u.id))
                  .map((u) => [String(u.id), u])
              );
            }
          }

          let applicantsById = new Map<string, ContactLookupRow>();
          if (workerIds.length > 0) {
            const { data: applicantsData, error: applicantsError } = await supabase
              .from("applicants")
              .select("id, email, phone")
              .in("id", workerIds);
            if (applicantsError) {
              console.warn("Failed to load applicants contact data:", applicantsError.message);
            } else {
              applicantsById = new Map(
                ((applicantsData as ContactLookupRow[] | null) ?? [])
                  .filter((a) => Boolean(a.id))
                  .map((a) => [String(a.id), a])
              );
            }
          }

          return rows.map((row) => {
            const workerId = typeof row.id === "string" ? row.id : "";
            const userId = typeof row.user_id === "string" ? row.user_id : "";
            const userContact = userId ? usersById.get(userId) : undefined;
            const applicantContact = workerId ? applicantsById.get(workerId) : undefined;
            return {
              ...row,
              user_email: userContact?.email ?? null,
              user_phone: userContact?.phone ?? null,
              applicant_email: applicantContact?.email ?? null,
              applicant_phone: applicantContact?.phone ?? null,
            };
          });
        };

        const enriched = await withContacts();
        const total =
          tenantScope.mode === "scoped"
            ? headOnly
              ? narrowed.length
              : enriched.length
            : (count ?? enriched.length ?? 0);
        return Response.json({
          total,
          workers: headOnly ? [] : enriched,
        });
      }

      const errMsg = error?.message || "Supabase query failed";
      lastMessage = errMsg;
      console.error("Supabase error:", error);
      const retry =
        errMsg === "Invalid API key" && key === serviceKey && anonKey;
      if (!retry) {
        return Response.json({ error: errMsg }, { status: 500 });
      }
    }

    return Response.json({ error: lastMessage }, { status: 500 });
  } catch (err: unknown) {
    console.error("API ERROR:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}