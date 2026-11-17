import "server-only";

import { cookies, headers } from "next/headers";
import { createClient as createSb } from "@supabase/supabase-js";
import { getDefaultLegalDocument } from "@/lib/legal/defaults";
import {
  isSystemLegalDocumentKey,
  type SystemLegalDocumentKey,
} from "@/lib/legal/document-keys";
import { legalRecordToDocument, type LegalDocument, type LegalSection } from "@/lib/legal/types";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";

function normalizeSections(value: unknown): LegalSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((section) => {
      if (!section || typeof section !== "object") return null;
      const row = section as { title?: unknown; paragraphs?: unknown };
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const paragraphs = Array.isArray(row.paragraphs)
        ? row.paragraphs
            .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
            .map((p) => p.trim())
        : [];
      if (!title || paragraphs.length === 0) return null;
      return { title, paragraphs };
    })
    .filter((section): section is LegalSection => section !== null);
}

function fallbackDocument(documentKey: string): LegalDocument | null {
  if (!isSystemLegalDocumentKey(documentKey)) return null;
  return getDefaultLegalDocument(documentKey);
}

async function resolveTenantSlugFromRequest(explicitSlug?: string | null): Promise<string | null> {
  const trimmed = explicitSlug?.trim().toLowerCase() || null;
  if (trimmed && trimmed.length >= 2) return trimmed;

  const hdrs = await headers();
  const host = resolveRequestTenantHost(hdrs);
  if (host.subdomainLabel) return host.subdomainLabel.toLowerCase();

  const jar = await cookies();
  const fromCookie = jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase() || null;
  return fromCookie && fromCookie.length >= 2 ? fromCookie : null;
}

function createPublicClient() {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) return null;
  return createSb(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadPublishedLegalDocument(options: {
  documentKey: string;
  tenantSlug?: string | null;
  publishedOnly?: boolean;
}): Promise<LegalDocument> {
  const documentKey = options.documentKey.trim().toLowerCase();
  const publishedOnly = options.publishedOnly !== false;
  const fallback = fallbackDocument(documentKey);

  try {
    const slug = await resolveTenantSlugFromRequest(options.tenantSlug);
    const supabase = createServiceRoleClient() ?? createPublicClient();
    if (!supabase || !slug) {
      return fallback ?? { title: "Legal document", lastUpdated: null, sections: [] };
    }

    const tenant = await resolvePublicTenant(supabase, slug);
    if (!tenant) {
      return fallback ?? { title: "Legal document", lastUpdated: null, sections: [] };
    }

    let query = supabase
      .from("legal_documents")
      .select("title, last_updated_label, sections, is_published")
      .eq("tenant_id", tenant.id)
      .eq("document_key", documentKey);

    if (publishedOnly) query = query.eq("is_published", true);

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return fallback ?? { title: "Legal document", lastUpdated: null, sections: [] };
    }

    const sections = normalizeSections((data as { sections?: unknown }).sections);
    if (sections.length === 0) {
      return fallback ?? { title: "Legal document", lastUpdated: null, sections: [] };
    }

    return legalRecordToDocument({
      title: String((data as { title?: string }).title || fallback?.title || "Legal document"),
      last_updated_label:
        typeof (data as { last_updated_label?: string | null }).last_updated_label === "string"
          ? (data as { last_updated_label: string }).last_updated_label
          : null,
      sections,
    });
  } catch (error) {
    console.error("[legal] loadPublishedLegalDocument", error);
    return fallback ?? { title: "Legal document", lastUpdated: null, sections: [] };
  }
}

export async function loadSystemLegalDocument(
  key: SystemLegalDocumentKey,
  tenantSlug?: string | null
): Promise<LegalDocument> {
  return loadPublishedLegalDocument({ documentKey: key, tenantSlug });
}
