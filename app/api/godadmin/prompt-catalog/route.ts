import { NextRequest, NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { INDUSTRY_CATALOG, promptStatusLabelForIndustry } from "@/lib/ai-catalog/industry-catalog";
import { invalidateAiPromptCaches } from "@/lib/ai-catalog/cache";
import { resolvePromptVersion } from "@/lib/ai-catalog/resolve-prompt";
import { PromptNotConfiguredError } from "@/lib/ai-catalog/errors";

function nestedRecord<T extends object>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const [versions, bindings, gates, runs] = await Promise.all([
    supabase
      .from("ai_prompt_version")
      .select(
        "id, template_id, version_number, status, content_hash, published_at, change_reason, effective_from, effective_to, system_prompt, user_prompt_template, response_schema, model_config, ai_prompt_template!inner(tenant_id, ai_feature!inner(key), ai_variant!inner(key), ai_vertical!inner(key))"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("tenant_ai_binding")
      .select("id, tenant_id, mode, is_enabled, pinned_version_id, tenants(name)")
      .limit(100),
    supabase.from("ai_client_gate").select("id, tenant_id, match_type, match_value, feature_key, variant_key, vertical_key_override, is_active, priority"),
    supabase
      .from("ai_prompt_run")
      .select("id, tenant_id, feature_key, variant_key, vertical_key, industry_key, status, error_code, prompt_version_id, content_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const mappedVersions = (versions.data ?? []).map((row) => {
    const template = nestedRecord<{
      tenant_id: string | null;
      ai_feature: { key: string } | { key: string }[];
      ai_variant: { key: string } | { key: string }[];
      ai_vertical: { key: string } | { key: string }[];
    }>(row.ai_prompt_template);
    const feature = nestedRecord<{ key: string }>(template?.ai_feature);
    const variant = nestedRecord<{ key: string }>(template?.ai_variant);
    const vertical = nestedRecord<{ key: string }>(template?.ai_vertical);
    return {
      id: row.id,
      template_id: row.template_id,
      version_number: row.version_number,
      status: row.status,
      content_hash: row.content_hash,
      published_at: row.published_at,
      change_reason: row.change_reason,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      system_prompt: row.system_prompt,
      user_prompt_template: row.user_prompt_template,
      response_schema: row.response_schema,
      model_config: row.model_config,
      feature_key: feature?.key ?? "",
      variant_key: variant?.key ?? "",
      vertical_key: vertical?.key ?? "",
      tenant_id: template?.tenant_id ?? null,
    };
  });

  return NextResponse.json({
    industries: INDUSTRY_CATALOG.map((entry) => ({
      ...entry,
      promptStatus: promptStatusLabelForIndustry(entry),
    })),
    versions: mappedVersions,
    bindings: bindings.data ?? [],
    gates: gates.data ?? [],
    runs: runs.data ?? [],
    errors: {
      versions: versions.error?.message ?? null,
      bindings: bindings.error?.message ?? null,
      gates: gates.error?.message ?? null,
      runs: runs.error?.message ?? null,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "publish") {
    const versionId = String(body.versionId ?? "");
    const changeReason = String(body.changeReason ?? "");
    const { data, error } = await supabase.rpc("publish_ai_prompt_version", {
      p_version_id: versionId,
      p_change_reason: changeReason,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await invalidateAiPromptCaches();
    return NextResponse.json({ ok: true, versionId: data });
  }

  if (action === "retire") {
    const versionId = String(body.versionId ?? "");
    const { data, error } = await supabase.rpc("retire_ai_prompt_version", {
      p_version_id: versionId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await invalidateAiPromptCaches();
    return NextResponse.json({ ok: true, versionId: data });
  }

  if (action === "create_draft") {
    const sourceVersionId = String(body.sourceVersionId ?? "");
    const { data: source, error: sourceError } = await supabase
      .from("ai_prompt_version")
      .select("template_id, system_prompt, user_prompt_template, response_schema, model_config")
      .eq("id", sourceVersionId)
      .maybeSingle();
    if (sourceError || !source) {
      return NextResponse.json({ error: sourceError?.message || "Source version not found" }, { status: 400 });
    }
    const { data: last } = await supabase
      .from("ai_prompt_version")
      .select("version_number")
      .eq("template_id", source.template_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("ai_prompt_version")
      .insert({
        template_id: source.template_id,
        version_number: Number(last?.version_number ?? 0) + 1,
        status: "draft",
        system_prompt: source.system_prompt,
        user_prompt_template: source.user_prompt_template,
        response_schema: source.response_schema ?? {},
        model_config: source.model_config ?? {},
        source_version_id: sourceVersionId,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, versionId: data.id });
  }

  if (action === "save_draft") {
    const versionId = String(body.versionId ?? "");
    const { data: existing, error: existingError } = await supabase
      .from("ai_prompt_version")
      .select("id, status")
      .eq("id", versionId)
      .maybeSingle();
    if (existingError || !existing) {
      return NextResponse.json({ error: existingError?.message || "Version not found" }, { status: 400 });
    }
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Published and retired prompt bodies cannot be edited." }, { status: 400 });
    }
    const { error } = await supabase
      .from("ai_prompt_version")
      .update({
        system_prompt: String(body.systemPrompt ?? ""),
        user_prompt_template: String(body.userPromptTemplate ?? ""),
        response_schema: body.responseSchema && typeof body.responseSchema === "object" ? body.responseSchema : {},
        model_config: body.modelConfig && typeof body.modelConfig === "object" ? body.modelConfig : {},
        change_reason: typeof body.changeReason === "string" ? body.changeReason : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", versionId)
      .eq("status", "draft");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, versionId });
  }

  if (action === "resolve") {
    try {
      const resolved = await resolvePromptVersion(supabase, {
        tenantId: String(body.tenantId ?? ""),
        featureKey: body.featureKey ?? "candidate_match",
        variantKey: body.variantKey ?? "default",
        industryKey: body.industryKey ?? null,
        tenantPrimaryIndustryKey: body.tenantPrimaryIndustryKey ?? null,
        clientName: body.clientName ?? null,
        sourceKey: body.sourceKey ?? null,
      });
      return NextResponse.json({
        promptVersionId: resolved.promptVersionId,
        resolvedVerticalKey: resolved.resolvedVerticalKey,
        variantKey: resolved.variantKey,
        source: resolved.source,
        fallbackApplied: resolved.fallbackApplied,
        contentHash: resolved.contentHash,
      });
    } catch (error) {
      if (error instanceof PromptNotConfiguredError) {
        return NextResponse.json(error.toJSON(), { status: 422 });
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Resolve failed" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
