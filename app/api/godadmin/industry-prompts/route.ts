import { NextRequest, NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePromptVersion } from "@/lib/ai-catalog/resolve-prompt";
import { PromptNotConfiguredError } from "@/lib/ai-catalog/errors";
import {
  INDUSTRY_PROMPT_SUPPORTED_VARIABLES,
  INDUSTRY_PROMPT_VARIANTS,
  INDUSTRY_PROMPT_VARIANT_LABELS,
  isIndustryPromptVariantKey,
  parseIndustryPromptSavePayload,
} from "@/lib/godadmin/industry-prompts";
import {
  createIndustryPromptDraft,
  getIndustryPromptDetail,
  listIndustryPrompts,
  restoreIndustryPromptVersion,
  saveIndustryPromptVersion,
} from "@/lib/godadmin/industry-prompts-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const industryKey = req.nextUrl.searchParams.get("industryKey")?.trim() || "";
  const variantRaw = req.nextUrl.searchParams.get("variantKey")?.trim() || "quick";

  try {
    if (industryKey) {
      if (!isIndustryPromptVariantKey(variantRaw)) {
        return NextResponse.json({ error: `Unsupported variantKey: ${variantRaw}` }, { status: 400 });
      }
      const detail = await getIndustryPromptDetail(supabase, industryKey, variantRaw);
      return NextResponse.json({
        detail,
        variants: INDUSTRY_PROMPT_VARIANTS.map((key) => ({
          key,
          label: INDUSTRY_PROMPT_VARIANT_LABELS[key],
        })),
        supportedVariables: INDUSTRY_PROMPT_SUPPORTED_VARIABLES[variantRaw],
      });
    }

    const industries = await listIndustryPrompts(supabase);
    return NextResponse.json({
      industries,
      variants: INDUSTRY_PROMPT_VARIANTS.map((key) => ({
        key,
        label: INDUSTRY_PROMPT_VARIANT_LABELS[key],
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load industry prompts" },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const action = String((body as { action?: string })?.action ?? "");

  try {
    if (action === "save") {
      const parsed = parseIndustryPromptSavePayload(body);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const result = await saveIndustryPromptVersion(supabase, {
        ...parsed,
        actorUserId: auth.userId,
        request: req,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "create") {
      const industryKey = String((body as { industryKey?: string }).industryKey ?? "").trim();
      const variantKey = String((body as { variantKey?: string }).variantKey ?? "quick").trim();
      if (!industryKey) return NextResponse.json({ error: "industryKey is required." }, { status: 400 });
      if (!isIndustryPromptVariantKey(variantKey)) {
        return NextResponse.json({ error: `Unsupported variantKey: ${variantKey}` }, { status: 400 });
      }
      const result = await createIndustryPromptDraft(supabase, {
        industryKey,
        variantKey,
        actorUserId: auth.userId,
        request: req,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "restore") {
      const industryKey = String((body as { industryKey?: string }).industryKey ?? "").trim();
      const variantKey = String((body as { variantKey?: string }).variantKey ?? "").trim();
      const sourceVersionId = String((body as { sourceVersionId?: string }).sourceVersionId ?? "").trim();
      const changeNote =
        typeof (body as { changeNote?: unknown }).changeNote === "string"
          ? (body as { changeNote: string }).changeNote
          : null;
      if (!industryKey || !sourceVersionId) {
        return NextResponse.json(
          { error: "industryKey and sourceVersionId are required." },
          { status: 400 }
        );
      }
      if (!isIndustryPromptVariantKey(variantKey)) {
        return NextResponse.json({ error: `Unsupported variantKey: ${variantKey}` }, { status: 400 });
      }
      const result = await restoreIndustryPromptVersion(supabase, {
        industryKey,
        variantKey,
        sourceVersionId,
        changeNote,
        actorUserId: auth.userId,
        request: req,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "resolve") {
      const industryKey = String((body as { industryKey?: string }).industryKey ?? "").trim();
      const variantKey = String((body as { variantKey?: string }).variantKey ?? "quick").trim();
      const tenantId = String((body as { tenantId?: string }).tenantId ?? "").trim();
      try {
        const resolved = await resolvePromptVersion(supabase, {
          tenantId: tenantId || "00000000-0000-0000-0000-000000000000",
          featureKey: "candidate_match",
          variantKey: isIndustryPromptVariantKey(variantKey) ? variantKey : "quick",
          industryKey: industryKey || null,
          tenantPrimaryIndustryKey: industryKey || null,
        });
        return NextResponse.json({
          promptVersionId: resolved.promptVersionId,
          resolvedVerticalKey: resolved.resolvedVerticalKey,
          variantKey: resolved.variantKey,
          versionNumber: resolved.versionNumber,
          source: resolved.source,
          fallbackApplied: resolved.fallbackApplied,
          contentHash: resolved.contentHash,
        });
      } catch (error) {
        if (error instanceof PromptNotConfiguredError) {
          return NextResponse.json(error.toJSON(), { status: 422 });
        }
        throw error;
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Industry prompt action failed" },
      { status: 400 }
    );
  }
}
