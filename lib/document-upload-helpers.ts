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

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "application/x-pdf": "application/pdf",
  "application/acrobat": "application/pdf",
  "application/x-msword": "application/msword",
  "application/vnd.ms-word": "application/msword",
}

/** Browser placeholders — never treat these as the real file type. */
const IGNORED_BROWSER_MIMES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/force-download",
  "application/download",
  "application/x-download",
  "",
])

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export function normalizeDocumentMime(mime: string): string {
  // Strip parameters such as `application/pdf; charset=utf-8`.
  const m = mime.trim().toLowerCase().split(";")[0]?.trim() || ""
  return MIME_ALIASES[m] ?? m
}

function mimeFromFileName(fileName: string): string | null {
  const n = pathOrUrlForExtension(fileName).trim().replace(/\.+$/, "")
  const ext = n.split(".").pop()?.trim().toLowerCase() ?? ""
  return EXT_TO_MIME[ext] ?? null
}

function normalizeAcceptedType(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase().replace(/^\{|\}$/g, "")
  if (!v) return null
  if (v.startsWith(".")) return EXT_TO_MIME[v.slice(1)] ?? null
  if (EXT_TO_MIME[v]) return EXT_TO_MIME[v]
  return normalizeDocumentMime(v) || null
}

/**
 * Coerce tenant `accepted_file_types` from JSON arrays, Postgres `{a,b}` text, or scalars.
 */
export function coerceAcceptedFileTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeAcceptedType).filter((t): t is string => Boolean(t))
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    // Postgres text[] display / occasional stringified form: {application/pdf,image/png}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((part) => normalizeAcceptedType(part))
        .filter((t): t is string => Boolean(t))
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) return coerceAcceptedFileTypes(parsed)
    } catch {
      /* single extension / mime */
    }
    const one = normalizeAcceptedType(trimmed)
    return one ? [one] : []
  }
  return []
}

/**
 * Match a file against tenant `accepted_file_types`.
 * Treats jpg/jpeg aliases, file extensions (`pdf`, `.png`), and empty/octet-stream browser MIME
 * as allowed when the name matches. When any image type is listed, JPG/PNG/WebP are accepted.
 */
export function isAcceptedDocumentFileType(
  file: { type?: string; name?: string },
  accepted: string[] | null | undefined
): boolean {
  if (!accepted?.length) return true

  const allowed = new Set(coerceAcceptedFileTypes(accepted))
  if (allowed.size === 0) return true

  const rawType = typeof file.type === "string" ? file.type : ""
  const normalizedType = normalizeDocumentMime(rawType)
  const fileMime = IGNORED_BROWSER_MIMES.has(normalizedType) ? "" : normalizedType
  const nameMime = mimeFromFileName(file.name || "") || ""

  // Prefer extension when present — browsers often send wrong or empty MIME types.
  if (nameMime && allowed.has(nameMime)) return true
  if (fileMime && allowed.has(fileMime)) return true

  const candidateMimes = [fileMime, nameMime].filter(Boolean)
  if (candidateMimes.length === 0) return true

  const acceptsImages = [...allowed].some((m) => m.startsWith("image/"))
  if (
    acceptsImages &&
    candidateMimes.some(
      (mime) => mime === "image/jpeg" || mime === "image/png" || mime === "image/webp"
    )
  ) {
    return true
  }

  // Last resort: raw filename extension against shorthand allow-list entries.
  const ext = pathOrUrlForExtension(file.name || "")
    .trim()
    .replace(/\.+$/, "")
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase()
  if (ext && (allowed.has(ext) || allowed.has(EXT_TO_MIME[ext] || ""))) return true

  return false
}

/** Server-side content check; browser MIME and a renamed extension are not trusted.
 * This detects type spoofing, not malware: AV/quarantine remains a separate control.
 */
export function validateDocumentUploadBytes(name: string, bytes: Uint8Array): string | null {
  const ext = name.toLowerCase().split(".").pop();
  const starts = (...signature: number[]) => signature.every((value, i) => bytes[i] === value);
  const valid = ext === "pdf" ? starts(0x25,0x50,0x44,0x46,0x2d)
    : ext === "png" ? starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)
    : ext === "jpg" || ext === "jpeg" ? starts(0xff,0xd8,0xff)
    : ext === "webp" ? starts(0x52,0x49,0x46,0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    : ext === "doc" ? starts(0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1)
    : ext === "docx" ? starts(0x50,0x4b,0x03,0x04) && new TextDecoder().decode(bytes).includes("word/document.xml")
    : false;
  return valid ? null : "File contents do not match an allowed document type.";
}
