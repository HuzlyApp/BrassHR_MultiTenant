import type { SupabaseClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets";
import { normalizeResumeWhitespace, sanitizeResumeForMatchAnalysis } from "./sanitize-resume";

export type ResumeTextResult = {
  text: string;
  sanitized: string;
  source: "worker_resumes" | "storage" | "empty";
  path: string | null;
};

async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdf = await pdfParse(buffer);
    return normalizeResumeWhitespace(pdf.text || "");
  }
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeResumeWhitespace(result.value || "");
  }
  if (lower.endsWith(".doc")) {
    throw new Error(
      "Legacy .doc files are not supported. Please save the resume as .docx or PDF."
    );
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return normalizeResumeWhitespace(buffer.toString("utf8"));
  }
  // Try PDF then DOCX as fallbacks when extension is missing
  try {
    const pdf = await pdfParse(buffer);
    if (pdf.text?.trim()) return normalizeResumeWhitespace(pdf.text);
  } catch {
    /* ignore */
  }
  try {
    const result = await mammoth.extractRawText({ buffer });
    if (result.value?.trim()) return normalizeResumeWhitespace(result.value);
  } catch {
    /* ignore */
  }
  return "";
}

/** Extract résumé text from an uploaded file buffer (PDF / DOCX). */
export async function extractResumeTextFromUpload(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  return extractTextFromBuffer(buffer, fileName);
}

/**
 * Resolve résumé text for a worker / applicant profile.
 * Prefer stored extracted_text; otherwise download from storage and extract.
 */
export async function resolveResumeTextForMatch(args: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string | null;
  applicantProfileId?: string | null;
}): Promise<ResumeTextResult> {
  const { supabase, tenantId, workerId, applicantProfileId } = args;

  if (workerId) {
    const { data: resumeRow } = await supabase
      .from("worker_resumes")
      .select("extracted_text, storage_path, file_name, original_file_name, uploaded_at")
      .eq("worker_id", workerId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const extracted = (resumeRow?.extracted_text as string | null)?.trim();
    if (extracted) {
      const normalized = normalizeResumeWhitespace(extracted);
      return {
        text: normalized,
        sanitized: sanitizeResumeForMatchAnalysis(normalized),
        source: "worker_resumes",
        path: (resumeRow?.storage_path as string | null) ?? null,
      };
    }

    const path = (resumeRow?.storage_path as string | null)?.trim();
    if (path) {
      const fromStorage = await downloadAndExtract(
        supabase,
        path,
        (resumeRow?.file_name as string | null) ||
          (resumeRow?.original_file_name as string | null)
      );
      if (fromStorage) return fromStorage;
    }

    const { data: req } = await supabase
      .from("worker_requirements")
      .select("resume_path")
      .eq("worker_id", workerId)
      .maybeSingle();
    const reqPath = (req?.resume_path as string | null)?.trim();
    if (reqPath) {
      const fromStorage = await downloadAndExtract(supabase, reqPath, null);
      if (fromStorage) return fromStorage;
    }
  }

  if (applicantProfileId) {
    const { data: profile } = await supabase
      .from("applicant_profiles")
      .select("resume_path, resume_file_name, worker_id")
      .eq("id", applicantProfileId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const path = (profile?.resume_path as string | null)?.trim();
    if (path) {
      const fromStorage = await downloadAndExtract(
        supabase,
        path,
        profile?.resume_file_name as string | null
      );
      if (fromStorage) return fromStorage;
    }

    // If profile links a worker we haven't tried, recurse once
    const linkedWorker = (profile?.worker_id as string | null)?.trim();
    if (linkedWorker && linkedWorker !== workerId) {
      return resolveResumeTextForMatch({
        supabase,
        tenantId,
        workerId: linkedWorker,
        applicantProfileId: null,
      });
    }
  }

  return { text: "", sanitized: "", source: "empty", path: null };
}

async function downloadAndExtract(
  supabase: SupabaseClient,
  path: string,
  fileName: string | null
): Promise<ResumeTextResult | null> {
  const { data, error } = await supabase.storage.from(WORKER_RESUMES_BUCKET).download(path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  const name = fileName || path.split("/").pop() || "resume.pdf";
  const text = await extractTextFromBuffer(buffer, name);
  if (!text.trim()) return null;
  return {
    text,
    sanitized: sanitizeResumeForMatchAnalysis(text),
    source: "storage",
    path,
  };
}
