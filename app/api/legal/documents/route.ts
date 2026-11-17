import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";
import { seedMissingSystemDocuments } from "@/lib/legal/admin-service";
import { applyCompanyNameToLegalDocument } from "@/lib/legal/company-tokens";
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

/** GET — published legal document for a tenant, with company name personalization. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const documentKey = (url.searchParams.get("key") || "").trim().toLowerCase();
    const tenantSlug = (url.searchParams.get("tenant") || "").trim().toLowerCase() || null;

    if (!documentKey) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    if (!tenantSlug) {
      if (!isSystemLegalDocumentKey(documentKey)) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({
        document: getDefaultLegalDocument(documentKey),
        source: "template",
      });
    }

    const service = createServiceRoleClient();
    const supabase = service ?? publicClient();
    if (!supabase) {
      if (!isSystemLegalDocumentKey(documentKey)) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({
        document: getDefaultLegalDocument(documentKey),
        source: "template",
      });
    }

    const tenant = await resolvePublicTenant(supabase, tenantSlug);
    if (!tenant) {
      if (!isSystemLegalDocumentKey(documentKey)) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({
        document: getDefaultLegalDocument(documentKey),
        source: "template",
      });
    }

    const companyName = tenant.name;

    if (service && isSystemLegalDocumentKey(documentKey)) {
      await seedMissingSystemDocuments(service, tenant.id, null, companyName);
    }

    const { data, error } = await supabase
      .from("legal_documents")
      .select("title, last_updated_label, sections, is_published, document_key")
      .eq("tenant_id", tenant.id)
      .eq("document_key", documentKey)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      const sections = normalizeSections((data as { sections?: unknown }).sections);
      if (sections.length > 0) {
        return NextResponse.json({
          tenantId: tenant.id,
          companyName,
          source: "tenant",
          document: applyCompanyNameToLegalDocument(
            legalRecordToDocument({
              title: String((data as { title: string }).title),
              last_updated_label:
                typeof (data as { last_updated_label?: string | null }).last_updated_label === "string"
                  ? (data as { last_updated_label: string }).last_updated_label
                  : null,
              sections,
            }),
            companyName
          ),
        });
      }
    }

    if (!isSystemLegalDocumentKey(documentKey)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({
      tenantId: tenant.id,
      companyName,
      source: "tenant_template",
      document: getDefaultLegalDocument(documentKey, companyName),
    });
  } catch (e) {
    console.error("[legal/documents]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
