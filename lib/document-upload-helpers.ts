/** Path or URL pathname for extension checks (query/hash on full URLs breaks /\.jpg$/). */
export function pathOrUrlForExtension(pathOrUrl: string): string {
  const t = pathOrUrl.trim()
  if (!t) return t
  if (/^https?:\/\//i.test(t)) {
    try {
      return new URL(t).pathname
    } catch {
      return t
    }
  }
  return t
}

/**
 * DB often stores the full public object URL; `getPublicUrl` expects a storage path only.
 * If `pathOrUrl` is already http(s), return it; otherwise join via `getPublicUrlFromPath`.
 */
export function resolveStoragePublicUrl(
  pathOrUrl: string | null | undefined,
  getPublicUrlFromPath: (storagePath: string) => string
): string | null {
  const v = pathOrUrl?.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  return getPublicUrlFromPath(v)
}

export function isPdfFile(file: File | null, fileName?: string, urlHint?: string | null): boolean {
  if (file?.type === "application/pdf") return true
  const n = pathOrUrlForExtension(fileName ?? file?.name ?? "")
  if (/\.pdf$/i.test(n)) return true
  if (urlHint) {
    const u = pathOrUrlForExtension(urlHint)
    if (/\.pdf$/i.test(u)) return true
  }
  return false
}

export function isImageFile(file: File | null, fileName?: string): boolean {
  if (file?.type?.startsWith("image/")) return true
  const n = pathOrUrlForExtension(fileName ?? file?.name ?? "")
  return /\.(png|jpe?g|jpeg|webp|gif)$/i.test(n)
}
