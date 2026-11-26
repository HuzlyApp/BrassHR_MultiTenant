import type { SupabaseClient } from "@supabase/supabase-js";
import { parseStoragePublicUrl } from "@/lib/supabase-storage-url";
import {
  WORKER_REQUIRED_FILES_BUCKET,
  WORKER_RESUMES_BUCKET,
} from "@/lib/supabase-storage-buckets";

/** Private bearer links are deliberately short-lived, including legacy callers. */
export const PRIVATE_DOCUMENT_URL_TTL_SECONDS = 120;
export function privateDocumentUrlTtl(requested = PRIVATE_DOCUMENT_URL_TTL_SECONDS): number {
  return Number.isFinite(requested) ? Math.max(60, Math.min(300, Math.floor(requested))) : PRIVATE_DOCUMENT_URL_TTL_SECONDS;
}

const FALLBACK_BUCKETS = [
  WORKER_REQUIRED_FILES_BUCKET,
  WORKER_RESUMES_BUCKET,
  "worker-onboarding",
  "docs",
] as const;

export type StoredStorageReference =
  | { kind: "storage"; bucket: string; path: string }
  | { kind: "external"; url: string };

/** Parse a DB value that may be a storage path, public object URL, or external link. */
export function parseStoredStorageReference(stored: string): StoredStorageReference | null {
  const value = stored.trim();
  if (!value) return null;

  if (value.startsWith("/api/")) {
    return { kind: "external", url: value };
  }

  if (/^https?:\/\//i.test(value)) {
    const parsed = parseStoragePublicUrl(value);
    if (parsed) {
      return { kind: "storage", bucket: parsed.bucket, path: parsed.path };
    }
    if (value.includes("/storage/v1/object/sign/")) {
      try {
        const url = new URL(value);
        const object = url.pathname.split("/storage/v1/object/sign/")[1];
        const slash = object?.indexOf("/") ?? -1;
        if (slash > 0) return { kind: "storage", bucket: decodeURIComponent(object.slice(0, slash)), path: decodeURIComponent(object.slice(slash + 1)) };
      } catch { return null; }
      return null;
    }
    return { kind: "external", url: value };
  }

  return { kind: "storage", bucket: WORKER_REQUIRED_FILES_BUCKET, path: value };
}

export type ResolveStorageAccessibleUrlOptions = {
  defaultBucket?: string;
  expiresIn?: number;
  extraBuckets?: string[];
  downloadFileName?: string | null;
};

async function trySignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number,
  downloadFileName?: string | null
): Promise<string | null> {
  const download = downloadFileName?.trim();
  const signed = download
    ? await supabase.storage.from(bucket).createSignedUrl(path, expiresIn, { download })
    : await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
  return null;
}

/**
 * Turn a stored path or legacy public URL into a browser-accessible URL.
 * Private buckets fail closed when signing fails; stored signed URLs are re-signed.
 */
export async function resolveStorageAccessibleUrl(
  supabase: SupabaseClient,
  stored: string | null | undefined,
  options?: ResolveStorageAccessibleUrlOptions
): Promise<string | null> {
  const raw = stored?.trim();
  if (!raw) return null;

  const ref = parseStoredStorageReference(raw);
  if (!ref) return null;
  if (ref.kind === "external") return ref.url;

  const expiresIn = privateDocumentUrlTtl(options?.expiresIn);
  const downloadFileName = options?.downloadFileName?.trim() || null;
  const buckets = Array.from(
    new Set(
      [
        ref.bucket,
        options?.defaultBucket,
        WORKER_REQUIRED_FILES_BUCKET,
        ...(options?.extraBuckets ?? []),
        ...FALLBACK_BUCKETS,
      ].filter((b): b is string => Boolean(b?.trim()))
    )
  );

  const direct = await trySignedUrl(supabase, ref.bucket, ref.path, expiresIn, downloadFileName);
  if (direct) return direct;

  const otherBuckets = buckets.filter((bucket) => bucket !== ref.bucket);
  if (otherBuckets.length > 0) {
    const results = await Promise.all(
      otherBuckets.map((bucket) =>
        trySignedUrl(supabase, bucket, ref.path, expiresIn, downloadFileName)
      )
    );
    const hit = results.find(Boolean);
    if (hit) return hit;
  }

  return null;
}
