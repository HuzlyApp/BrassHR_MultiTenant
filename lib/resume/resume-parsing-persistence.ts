import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { GROK_RESUME_MODEL } from "@/lib/resume/grok-parse-resume";

export const RESUME_PARSER_PROVIDER = "xai";
export const RESUME_PARSER_VERSION = "1";

export type ResumeParsingStatus = "pending" | "processing" | "completed" | "failed";

export type CachedParseResult = {
  id: string;
  parsedJson: Record<string, string> | null;
  parsingStatus: ResumeParsingStatus;
  reused: boolean;
};

export function hashResumeFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function findReusableParseResult(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    fileHash: string;
    parserVersion?: string;
  }
): Promise<CachedParseResult | null> {
  const parserVersion = input.parserVersion ?? RESUME_PARSER_VERSION;
  const { data, error } = await supabase
    .from("resume_parsing_results")
    .select("id, parsed_json, parsing_status")
    .eq("tenant_id", input.tenantId)
    .eq("file_hash", input.fileHash)
    .eq("parser_version", parserVersion)
    .in("parsing_status", ["completed", "processing", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) return null;

  return {
    id: String(data.id),
    parsedJson: (data.parsed_json as Record<string, string> | null) ?? null,
    parsingStatus: data.parsing_status as ResumeParsingStatus,
    reused: data.parsing_status === "completed",
  };
}

export async function claimParseJob(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    workerId: string;
    applicantId: string;
    resumeFileId: string;
    fileHash: string;
    forceReprocess?: boolean;
    actorUserId?: string | null;
    request?: Request;
  }
): Promise<
  | { kind: "reuse"; result: CachedParseResult }
  | { kind: "run"; parseResultId: string }
  | { kind: "wait"; parseResultId: string }
> {
  if (!input.forceReprocess) {
    const existing = await findReusableParseResult(supabase, {
      tenantId: input.tenantId,
      fileHash: input.fileHash,
    });

    if (existing?.parsingStatus === "completed" && existing.parsedJson) {
      void writeActivityLog({
        actorUserId: input.actorUserId ?? null,
        action: "resume_parsing_reused_from_cache",
        entityType: "resume_parsing_results",
        entityId: existing.id,
        tenantId: input.tenantId,
        metadata: {
          worker_id: input.workerId,
          resume_file_id: input.resumeFileId,
          file_hash: input.fileHash,
        },
        request: input.request,
      });
      return { kind: "reuse", result: existing };
    }

    if (existing?.parsingStatus === "processing" || existing?.parsingStatus === "pending") {
      return { kind: "wait", parseResultId: existing.id };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("resume_parsing_results")
    .insert({
      tenant_id: input.tenantId,
      worker_id: input.workerId,
      applicant_id: input.applicantId,
      resume_file_id: input.resumeFileId,
      file_hash: input.fileHash,
      parser_provider: RESUME_PARSER_PROVIDER,
      parser_model: GROK_RESUME_MODEL,
      parser_version: RESUME_PARSER_VERSION,
      parsing_status: "processing",
      started_at: now,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await findReusableParseResult(supabase, {
        tenantId: input.tenantId,
        fileHash: input.fileHash,
      });
      if (existing?.parsingStatus === "completed") {
        return { kind: "reuse", result: existing };
      }
      if (existing) return { kind: "wait", parseResultId: existing.id };
    }
    throw error;
  }

  void writeActivityLog({
    actorUserId: input.actorUserId ?? null,
    action: "resume_parsing_started",
    entityType: "resume_parsing_results",
    entityId: String(data.id),
    tenantId: input.tenantId,
    metadata: {
      worker_id: input.workerId,
      resume_file_id: input.resumeFileId,
      file_hash: input.fileHash,
      force_reprocess: Boolean(input.forceReprocess),
    },
    request: input.request,
  });

  return { kind: "run", parseResultId: String(data.id) };
}

export async function completeParseResult(
  supabase: SupabaseClient,
  input: {
    parseResultId: string;
    tenantId: string;
    parsedJson: Record<string, string> | null;
    parsingStatus: Extract<ResumeParsingStatus, "completed" | "failed">;
    errorCode?: string | null;
    errorMessage?: string | null;
    durationMs?: number;
    request?: Request;
  }
): Promise<void> {
  const completedAt = new Date().toISOString();
  await supabase
    .from("resume_parsing_results")
    .update({
      parsing_status: input.parsingStatus,
      parsed_json: input.parsedJson,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      completed_at: completedAt,
    })
    .eq("id", input.parseResultId);

  void writeActivityLog({
    actorUserId: null,
    action:
      input.parsingStatus === "completed"
        ? "resume_parsing_completed"
        : "resume_parsing_failed",
    entityType: "resume_parsing_results",
    entityId: input.parseResultId,
    tenantId: input.tenantId,
    metadata: {
      duration_ms: input.durationMs ?? null,
      error_code: input.errorCode ?? null,
    },
    request: input.request,
  });
}
