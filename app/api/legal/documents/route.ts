import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";
import { getDefaultLegalDocument } from "@/lib/legal/defaults";
import { isSystemLegalDocumentKey } from "@/lib/legal/document-keys";
import { legalRecordToDocument, type LegalSection } from "@/lib/legal/types";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

function publicClient() {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) return null;
  return createSb(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** GET — public published legal document by key + tenant slug (falls back to platform defaults). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const documentKey = (url.searchParams.get("key") || "").trim().toLowerCase();
    const tenantSlug = (url.searchParams.get("tenant") || "").trim().toLowerCase() || null;

    if (!documentKey) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const fallback = isSystemLegalDocumentKey(documentKey)
      ? getDefaultLegalDocument(documentKey)
      : null;

    if (!tenantSlug) {
      if (!fallback) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ document: fallback, source: "default" });
    }

    const supabase = createServiceRoleClient() ?? publicClient();
    if (!supabase) {
      if (!fallback) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ document: fallback, source: "default" });
    }

    const tenant = await resolvePublicTenant(supabase, tenantSlug);
    if (!tenant) {
      if (!fallback) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ document: fallback, source: "default" });
    }

    const { data, error } = await supabase
      .from("legal_documents")
      .select("title, last_updated_label, sections, is_published, document_key")
      .eq("tenant_id", tenant.id)
      .eq("document_key", documentKey)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      if (!fallback) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ document: fallback, source: "default", tenantId: tenant.id });
    }

    const sections = normalizeSections((data as { sections?: unknown }).sections);
    if (sections.length === 0) {
      if (!fallback) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ document: fallback, source: "default", tenantId: tenant.id });
    }

    return NextResponse.json({
      tenantId: tenant.id,
      source: "tenant",
      document: legalRecordToDocument({
        title: String((data as { title: string }).title),
        last_updated_label:
          typeof (data as { last_updated_label?: string | null }).last_updated_label === "string"
            ? (data as { last_updated_label: string }).last_updated_label
            : null,
        sections,
      }),
    });
  } catch (e) {
    console.error("[legal/documents]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
