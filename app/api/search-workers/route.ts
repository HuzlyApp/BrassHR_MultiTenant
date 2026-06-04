import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { narrowWorkerRowsByTenant } from "@/lib/workers/tenant-query"
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache"
import { enforceRateLimit } from "@/lib/security/rate-limit"

type RpcRow = Record<string, unknown>
type ContactLookupRow = { id: string | null; email: string | null; phone: string | null }
type WorkerSelectClient = {
  from: (table: "worker") => {
    select: (columns: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function getRowCoord(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

async function fallbackNearbyWorkers(
  supabase: unknown,
  opts: { lat: number; lng: number; radiusMiles: number }
): Promise<{ rows: RpcRow[]; error: string | null }> {
  const db = supabase as WorkerSelectClient
  const selectVariants = [
    "id, user_id, first_name, last_name, job_role, email, phone, city, state, address1, zip, created_at, status, worker_status, lat, lng",
    "id, user_id, first_name, last_name, job_role, email, phone, city, state, address1, zip, created_at, status, lat, lng",
    "id, user_id, first_name, last_name, job_role, email, phone, city, state, address1, zip, created_at, lat, lng",
    "id, user_id, first_name, last_name, job_role, email, phone, city, state, address1, zip, created_at, latitude, longitude",
  ]

  let wk: Record<string, unknown>[] | null = null
  let lastError: string | null = null

  for (const selectCols of selectVariants) {
    const { data, error } = await db.from("worker").select(selectCols)
    if (!error) {
      wk = (data ?? []).map((row) => row as Record<string, unknown>)
      lastError = null
      break
    }
    lastError = error.message
  }

  if (!wk) {
    return { rows: [], error: lastError ?? "Failed to fetch worker coordinates" }
  }

  const radiusMeters = opts.radiusMiles * 1609.344
  const rows: RpcRow[] = []
  for (const row of wk) {
    const rowLat = getRowCoord(row.lat) ?? getRowCoord(row.latitude)
    const rowLng = getRowCoord(row.lng) ?? getRowCoord(row.longitude)
    if (rowLat == null || rowLng == null) continue

    const distance = haversineMeters(opts.lat, opts.lng, rowLat, rowLng)
    if (distance > radiusMeters) continue

    rows.push({
      ...mapWorkerRow(row, { lat: opts.lat, lng: opts.lng }),
      lat: rowLat,
      lng: rowLng,
      distance_meters: distance,
    })
  }

  rows.sort((a, b) => {
    const ad = typeof a.distance_meters === "number" ? a.distance_meters : Number.POSITIVE_INFINITY
    const bd = typeof b.distance_meters === "number" ? b.distance_meters : Number.POSITIVE_INFINITY
    return ad - bd
  })

  return { rows, error: null }
}

function mergeById(a: RpcRow[], b: RpcRow[]): RpcRow[] {
  const map = new Map<string, RpcRow>()
  for (const r of a) {
    const id = r.id != null ? String(r.id) : ""
    if (id) map.set(id, { ...r })
  }
  for (const r of b) {
    const id = r.id != null ? String(r.id) : ""
    if (!id) continue
    if (!map.has(id)) map.set(id, { ...r })
  }
  return [...map.values()]
}

/** Map plain worker rows to the shape the map / results table expect. */
function mapWorkerRow(
  w: Record<string, unknown>,
  opts: { lat: number; lng: number }
): RpcRow {
  const lat = typeof w.lat === "number" ? w.lat : typeof w.latitude === "number" ? w.latitude : opts.lat
  const lng = typeof w.lng === "number" ? w.lng : typeof w.longitude === "number" ? w.longitude : opts.lng
  return {
    id: w.id,
    user_id: w.user_id ?? null,
    first_name: w.first_name ?? "",
    last_name: w.last_name ?? "",
    job_role: w.job_role ?? "",
    email: w.email ?? null,
    phone: w.phone ?? null,
    city: w.city ?? null,
    state: w.state ?? null,
    address1: w.address1 ?? null,
    zip: w.zip ?? null,
    address: (w.address1 as string) || (w.address as string) || null,
    created_at: w.created_at ?? null,
    status: (() => {
      const pipeline =
        typeof w.status === "string" ? w.status.trim().toLowerCase() : "";
      const legacy =
        typeof w.worker_status === "string"
          ? w.worker_status.trim().toLowerCase()
          : "";
      const pipelineStatuses = new Set([
        "new",
        "pending",
        "approved",
        "disapproved",
      ]);
      if (pipeline && pipelineStatuses.has(pipeline)) return pipeline;
      if (legacy && pipelineStatuses.has(legacy)) return legacy;
      return pipeline || legacy || null;
    })(),
    lat,
    lng,
    distance_meters: null,
  }
}

export async function POST(req: Request) {
  const auth = await requireStaffApiSession()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, {
    namespace: "worker-search",
    key: auth.userId,
    limit: Number(process.env.RATE_LIMIT_SEARCH_PER_MINUTE ?? 60),
    windowMs: 60 * 1000,
    failClosed: false,
  })
  if (limited) return limited

  const tenantScope = await resolveStaffTenantScope(auth.authUser)

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const supabase = createClient(url, key)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const lat = typeof b.lat === "number" ? b.lat : Number(b.lat)
  const lng = typeof b.lng === "number" ? b.lng : Number(b.lng)
  const radius = typeof b.radius === "number" ? b.radius : Number(b.radius)
  const place = typeof b.place === "string" ? b.place.trim() : ""

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
    return Response.json({ error: "Invalid lat/lng/radius" }, { status: 400 })
  }

  const scope =
    "tenantId" in tenantScope && tenantScope.tenantId
      ? ["tenant", String(tenantScope.tenantId)]
      : ["admin", auth.userId]
  const cacheKey = buildCacheKey("worker_search", scope, { lat, lng, radius, place })

  const narrowed = await getOrSetCache(
    cacheKey,
    async () => {
      let rpcRows: RpcRow[] = []
      const { data: rpcData, error: rpcError } = await supabase.rpc("nearby_workers", {
        lat,
        lng,
        radius_meters: radius * 1609.344, // miles -> meters
      })

      if (rpcError) {
        // Fallback if RPC is broken/missing (e.g. function references old columns)
        if (!place) {
          const fallback = await fallbackNearbyWorkers(supabase, { lat, lng, radiusMiles: radius })
          if (fallback.error) {
            throw new Error(`${rpcError.message} | Fallback failed: ${fallback.error}`)
          }
          rpcRows = fallback.rows
        }
      } else if (Array.isArray(rpcData)) {
        rpcRows = rpcData as RpcRow[]
      }

      let cityRows: RpcRow[] = []
      if (place) {
        // Match worker.city / state / address1 (free text often lives in address1)
        const segment = place.split(",")[0]?.trim() || place
        const term = segment.slice(0, 120)
        // Keep PostgREST `or()` values simple: no commas / wildcards in the literal
        const safe = term.replace(/[^\p{L}\p{N}\s\-]/gu, " ").replace(/\s+/g, " ").trim()
        if (safe.length >= 2) {
          const pattern = `%${safe}%`

          const { data: wk, error: wErr } = await supabase
            .from("worker")
            .select("id, user_id, first_name, last_name, job_role, email, phone, city, state, address1, zip, created_at")
            .or(`city.ilike.${pattern},state.ilike.${pattern},address1.ilike.${pattern}`)

          if (wErr) {
            throw new Error(wErr.message)
          }

          cityRows = (wk ?? []).map((row) => mapWorkerRow(row as Record<string, unknown>, { lat, lng }))
        }
      }

      const merged = mergeById(rpcRows, cityRows)
      const workerIds = Array.from(new Set(merged.map((r) => (r.id != null ? String(r.id) : "")).filter(Boolean)))
      const userIds = Array.from(
        new Set(merged.map((r) => (r.user_id != null ? String(r.user_id) : "")).filter(Boolean))
      )

      let usersById = new Map<string, ContactLookupRow>()
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, email, phone")
          .in("id", userIds)
        if (!usersError) {
          usersById = new Map(
            ((usersData as ContactLookupRow[] | null) ?? [])
              .filter((u) => Boolean(u.id))
              .map((u) => [String(u.id), u])
          )
        }
      }

      let applicantsById = new Map<string, ContactLookupRow>()
      if (workerIds.length > 0) {
        const { data: applicantsData, error: applicantsError } = await supabase
          .from("applicants")
          .select("id, email, phone")
          .in("id", workerIds)
        if (!applicantsError) {
          applicantsById = new Map(
            ((applicantsData as ContactLookupRow[] | null) ?? [])
              .filter((a) => Boolean(a.id))
              .map((a) => [String(a.id), a])
          )
        }
      }

      const enriched = merged.map((row) => {
        const workerId = row.id != null ? String(row.id) : ""
        const userId = row.user_id != null ? String(row.user_id) : ""
        const userContact = userId ? usersById.get(userId) : undefined
        const applicantContact = workerId ? applicantsById.get(workerId) : undefined
        return {
          ...row,
          user_email: userContact?.email ?? null,
          user_phone: userContact?.phone ?? null,
          applicant_email: applicantContact?.email ?? null,
          applicant_phone: applicantContact?.phone ?? null,
        }
      })
      return narrowWorkerRowsByTenant(
        supabase,
        tenantScope,
        enriched as Record<string, unknown>[]
      )
    },
    CACHE_TTL_SECONDS.searchResults
  )

  return Response.json(narrowed)
}