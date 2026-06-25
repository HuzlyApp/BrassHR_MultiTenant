import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export type OnboardingLibraryRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  slug: string;
  is_uncategorized: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingLibraryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isUncategorized: boolean;
  publishedCount: number;
  unpublishedCount: number;
  createdAt: string;
  updatedAt: string;
};

function slugifyName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `library-${Date.now()}`;
}

async function uniqueSlug(
  supabase: OnboardingDbClient,
  tenantId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("onboarding_libraries")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

export async function ensureDefaultOnboardingLibraries(
  supabase: OnboardingDbClient,
  tenantId: string
): Promise<void> {
  const { error } = await supabase.rpc("seed_tenant_onboarding_libraries", {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
}

export async function listOnboardingLibraries(
  supabase: OnboardingDbClient,
  tenantId: string
): Promise<OnboardingLibraryListItem[]> {
  await ensureDefaultOnboardingLibraries(supabase, tenantId);

  const { data: libraries, error: libError } = await supabase
    .from("onboarding_libraries")
    .select("id, tenant_id, name, description, slug, is_uncategorized, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("is_uncategorized", { ascending: false })
    .order("name", { ascending: true });

  if (libError) throw libError;

  const { data: flows, error: flowError } = await supabase
    .from("onboarding_flows")
    .select("library_id, status")
    .eq("tenant_id", tenantId);

  if (flowError) throw flowError;

  const counts = new Map<string, { published: number; unpublished: number }>();
  for (const flow of flows ?? []) {
    const libraryId = flow.library_id ? String(flow.library_id) : "__none__";
    const bucket = counts.get(libraryId) ?? { published: 0, unpublished: 0 };
    if (flow.status === "published") {
      bucket.published += 1;
    } else {
      bucket.unpublished += 1;
    }
    counts.set(libraryId, bucket);
  }

  return (libraries ?? []).map((row) => {
    const lib = row as OnboardingLibraryRow;
    const libCounts = counts.get(lib.id) ?? { published: 0, unpublished: 0 };
    return {
      id: lib.id,
      name: lib.name,
      slug: lib.slug,
      description: lib.description,
      isUncategorized: lib.is_uncategorized,
      publishedCount: libCounts.published,
      unpublishedCount: libCounts.unpublished,
      createdAt: lib.created_at,
      updatedAt: lib.updated_at,
    };
  });
}

export async function createOnboardingLibrary(
  supabase: OnboardingDbClient,
  tenantId: string,
  input: { name: string; description?: string; createdBy: string }
): Promise<OnboardingLibraryListItem> {
  const name = input.name.trim() || "New Library";
  const baseSlug = slugifyName(name);
  const slug = await uniqueSlug(supabase, tenantId, baseSlug);

  const { data, error } = await supabase
    .from("onboarding_libraries")
    .insert({
      tenant_id: tenantId,
      name,
      description: input.description?.trim() || null,
      slug,
      created_by: input.createdBy,
    })
    .select("id, tenant_id, name, description, slug, is_uncategorized, created_at, updated_at")
    .single();

  if (error) throw error;

  const row = data as OnboardingLibraryRow;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isUncategorized: row.is_uncategorized,
    publishedCount: 0,
    unpublishedCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOnboardingLibraryById(
  supabase: OnboardingDbClient,
  tenantId: string,
  libraryId: string
): Promise<OnboardingLibraryRow | null> {
  const { data, error } = await supabase
    .from("onboarding_libraries")
    .select("id, tenant_id, name, description, slug, is_uncategorized, created_by, created_at, updated_at")
    .eq("id", libraryId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data as OnboardingLibraryRow | null;
}

export async function getOnboardingLibraryBySlug(
  supabase: OnboardingDbClient,
  tenantId: string,
  slug: string
): Promise<OnboardingLibraryRow | null> {
  const { data, error } = await supabase
    .from("onboarding_libraries")
    .select("id, tenant_id, name, description, slug, is_uncategorized, created_by, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data as OnboardingLibraryRow | null;
}

/** Resolve library for flow listing: explicit id, slug, or default onboarding library. */
export async function resolveOnboardingLibraryForFlows(
  supabase: OnboardingDbClient,
  tenantId: string,
  opts?: { libraryId?: string; librarySlug?: string }
): Promise<OnboardingLibraryRow | null> {
  await ensureDefaultOnboardingLibraries(supabase, tenantId);

  if (opts?.libraryId) {
    return getOnboardingLibraryById(supabase, tenantId, opts.libraryId);
  }

  const slug = opts?.librarySlug?.trim() || "onboarding";
  return getOnboardingLibraryBySlug(supabase, tenantId, slug);
}
