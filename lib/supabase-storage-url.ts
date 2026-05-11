/**
 * Parse bucket + object path from a Supabase public object URL.
 */
export function parseStoragePublicUrl(
  publicUrl: string
): { bucket: string; path: string } | null {
  const m = publicUrl.trim().match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (!m) return null
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}
