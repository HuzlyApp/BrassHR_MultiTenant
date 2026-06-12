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

/**
 * Turn a stored path or legacy public URL into a browser-accessible URL.
 * Private buckets always use signed URLs — never /object/public/ links.
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

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(ref.path, expiresIn);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  return null;
}
