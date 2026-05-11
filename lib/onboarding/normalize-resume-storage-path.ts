import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"

/**
 * `worker_requirements.resume_path` may store:
 * - An object key within the bucket (e.g. `pending/uuid.pdf` or `Resume/BubbleJesonP.pdf`)
 * - A full Supabase Storage URL (`.../object/public/worker-resumes/...`)
 * - A key prefixed with `{bucket}/`
 *
 * `storage.from(bucket).createSignedUrl()` expects the key only (no bucket prefix, not a full URL).
 */
export function normalizeResumeStorageObjectPath(raw: string): string {
  const s = raw.trim()
  if (!s) return ""

  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s)
      const pathname = u.pathname
      const needle = `/${WORKER_RESUMES_BUCKET}/`
      const idx = pathname.indexOf(needle)
      if (idx !== -1) {
        return decodeURIComponent(pathname.slice(idx + needle.length))
      }
    } catch {
      /* ignore */
    }
  }

  let out = s
  const withSlash = `${WORKER_RESUMES_BUCKET}/`
  if (out.startsWith(withSlash)) {
    out = out.slice(withSlash.length)
  }
  return out.replace(/^\/+/, "")
}
