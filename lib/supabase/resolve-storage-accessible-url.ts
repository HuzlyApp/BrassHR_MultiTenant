import type { SupabaseClient } from "@supabase/supabase-js";
import { parseStoragePublicUrl } from "@/lib/supabase-storage-url";
import {
  WORKER_REQUIRED_FILES_BUCKET,
  WORKER_RESUMES_BUCKET,
} from "@/lib/supabase-storage-buckets";

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
      return { kind: "external", url: value };
    }
    return { kind: "external", url: value };
  }

  return { kind: "storage", bucket: WORKER_REQUIRED_FILES_BUCKET, path: value };
}

export type ResolveStorageAccessibleUrlOptions = {
  defaultBucket?: string;
  expiresIn?: number;
  extraBuckets?: string[];
};

async function trySignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (!error && data?.signedUrl) return data.signedUrl;
  return null;
}

/**
 * Turn a stored path or legacy public URL into a browser-accessible URL.
 * Private buckets use signed URLs; legacy public object URLs are returned when signing fails.
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

  const expiresIn = options?.expiresIn ?? 3600;
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

  const direct = await trySignedUrl(supabase, ref.bucket, ref.path, expiresIn);
  if (direct) return direct;

  const otherBuckets = buckets.filter((bucket) => bucket !== ref.bucket);
  if (otherBuckets.length > 0) {
    const results = await Promise.all(
      otherBuckets.map((bucket) => trySignedUrl(supabase, bucket, ref.path, expiresIn))
    );
    const hit = results.find(Boolean);
    if (hit) return hit;
  }

  if (/^https?:\/\//i.test(raw) && raw.includes("/object/public/")) {
    return raw;
  }

  return null;
}
