import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFullJobDescriptionText,
  buildStructuredJobRequirements,
  jobMetaFromRequisition,
  type JobRequisitionForRequirements,
} from "./build-job-requirements";
import {
  generateMatchAnalysisWithGrok,
  MatchAnalysisGenerationError,
} from "./service";
import { resolveResumeTextForMatch } from "./extract-resume-text";
import {
  cacheStructuredRequirements,
  persistMatchRequirements,
  updateApplicationMatchFields,
} from "./persist";
import { snapshotCurrentAnalysisVersion } from "./versions";
import type {
  AiMatchPipelineStatus,
  MatchAnalysisResponse,
  PipelineProgressStep,
} from "./schema";

export type MatchAnalysisProgressEvent = {
  step: PipelineProgressStep;
  message: string;
  status?: AiMatchPipelineStatus;
};

export type RunMatchAnalysisResult = {
  status: AiMatchPipelineStatus;
  analysis: MatchAnalysisResponse | null;
  score: number | null;
  category: string | null;
  action: string | null;
  readiness: string | null;
  error: string | null;
  repaired: boolean;
  model: string | null;
};

async function setProgress(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  step: PipelineProgressStep,
  extra?: Record<string, unknown>
) {
  await updateApplicationMatchFields({
    supabase,
    tenantId,
    jobApplicationId: applicationId,
    patch: {
      ai_analysis_progress: step,
      ...extra,
    },
  });
}

/**
 * End-to-end match analysis for one job application.
 */
export async function runMatchAnalysisForApplication(args: {
  supabase: SupabaseClient;
  tenantId: string;
  jobApplicationId: string;
  recruiterNotes?: string | null;
  verifiedRecruiterInfo?: Record<string, unknown> | null;
  analyzedByUserId?: string | null;
  onProgress?: (event: MatchAnalysisProgressEvent) => void;
}): Promise<RunMatchAnalysisResult> {
  const {
    supabase,
    tenantId,
    jobApplicationId,
    recruiterNotes,
    verifiedRecruiterInfo,
    analyzedByUserId,
    onProgress,
  } = args;

  const emit = (step: PipelineProgressStep, message: string, status?: AiMatchPipelineStatus) => {
    onProgress?.({ step, message, status });
  };

  const { data: application, error: appError } = await supabase
    .from("job_applications")
    .select(
      "id, tenant_id, job_requisition_id, worker_id, applicant_profile_id, ai_match_status"
    )
    .eq("id", jobApplicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (appError) throw appError;
  if (!application) {
    return {
      status: "FAILED",
      analysis: null,
      score: null,
      category: null,
      action: null,
      readiness: null,
      error: "Application not found",
      repaired: false,
      model: null,
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("job_requisitions")
    .select(
      "id, public_title, qualifications, responsibilities, public_description, special_requirements, required_credentials, years_of_experience, years_experience_required, location, specialty, msp_client, msp_name, facility, facility_name, structured_requirements, ai_match_enabled, professions(name), specialties(name)"
    )
    .eq("id", application.job_requisition_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) {
    return {
      status: "FAILED",
      analysis: null,
      score: null,
      category: null,
      action: null,
      readiness: null,
      error: "Job requisition not found",
      repaired: false,
      model: null,
    };
  }

  if (job.ai_match_enabled === false) {
    return {
      status: "FAILED",
      analysis: null,
      score: null,
      category: null,
      action: null,
      readiness: null,
      error: "AI match is disabled for this job",
      repaired: false,
      model: null,
    };
  }

  emit("preparing", "Preparing résumé and job requirements", "ANALYZING");
  await updateApplicationMatchFields({
    supabase,
    tenantId,
    jobApplicationId,
    patch: {
      ai_match_status: "ANALYZING",
      ai_analysis_progress: "preparing",
      ai_analysis_error: null,
    },
  });

  try {
    const resume = await resolveResumeTextForMatch({
      supabase,
      tenantId,
      workerId: application.worker_id as string | null,
      applicantProfileId: application.applicant_profile_id as string | null,
      jobApplicationId,
    });

    if (!resume.sanitized.trim()) {
      emit("failed", "No résumé text available", "NEEDS_REVIEW");
      await updateApplicationMatchFields({
        supabase,
        tenantId,
        jobApplicationId,
        patch: {
          ai_match_status: "NEEDS_REVIEW",
          ai_analysis_progress: "failed",
          ai_analysis_error: "No résumé text available for analysis",
        },
      });
      return {
        status: "NEEDS_REVIEW",
        analysis: null,
        score: null,
        category: null,
        action: null,
        readiness: null,
        error: "No résumé text available for analysis",
        repaired: false,
        model: null,
      };
    }

    const structured = buildStructuredJobRequirements(job as JobRequisitionForRequirements);
    await cacheStructuredRequirements({
      supabase,
      tenantId,
      jobRequisitionId: job.id as string,
      structured,
    });

    const meta = jobMetaFromRequisition(job as JobRequisitionForRequirements);
    const fullJd = buildFullJobDescriptionText(job as JobRequisitionForRequirements);

    let notes = recruiterNotes?.trim() || "";
    if (!notes) {
      const { data: noteRows } = await supabase
        .from("worker_notes")
        .select("body")
        .eq("tenant_id", tenantId)
        .eq("application_id", jobApplicationId)
        .order("created_at", { ascending: false })
        .limit(5);
      notes = (noteRows ?? [])
        .map((n) => (n.body as string | null)?.trim() || "")
        .filter(Boolean)
        .join("\n---\n");
    }

    let verified = verifiedRecruiterInfo ?? null;
    if (!verified) {
      const { data: verifiedRows } = await supabase
        .from("job_application_verified_information")
        .select("category, title, details")
        .eq("tenant_id", tenantId)
        .eq("application_id", jobApplicationId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (verifiedRows?.length) {
        verified = { items: verifiedRows };
      }
    }

    const previousVersion = await snapshotCurrentAnalysisVersion({
      supabase,
      tenantId,
      applicationId: jobApplicationId,
      analyzedBy: analyzedByUserId ?? null,
    });
    const nextVersion = previousVersion + 1;

    emit("analyzing", "Running Grok match analysis", "ANALYZING");
    await setProgress(supabase, tenantId, jobApplicationId, "analyzing");

    const modelResult = await generateMatchAnalysisWithGrok({
      jobId: meta.jobId,
      jobTitle: meta.jobTitle,
      mspOrClient: meta.mspOrClient,
      specialty: meta.specialty,
      location: meta.location,
      structured,
      fullJobDescription: fullJd,
      resumeText: resume.sanitized,
      verifiedRecruiterInfo: verified ?? null,
      recruiterNotes: notes || null,
    });

    emit("validating", "Validating and rescoring", "ANALYZING");
    await setProgress(supabase, tenantId, jobApplicationId, "validating");

    const analysis = modelResult.analysis;

    emit("saving", "Saving analysis results", "ANALYZING");
    await setProgress(supabase, tenantId, jobApplicationId, "saving");

    await persistMatchRequirements({
      supabase,
      tenantId,
      jobApplicationId,
      analysis,
    });

    await updateApplicationMatchFields({
      supabase,
      tenantId,
      jobApplicationId,
      patch: {
        ai_match_status: "ANALYZED",
        ai_match_score: analysis.candidate_match.recommended_overall_match_score,
        ai_match_category: analysis.candidate_match.match_category,
        ai_match_action: analysis.candidate_match.recommended_action,
        ai_match_readiness: analysis.submission_readiness.readiness_status,
        ai_match_display_category:
          analysis.candidate_match.display_category ||
          analysis.candidate_match.match_category,
        ai_analysis_raw: modelResult.rawObject,
        ai_analysis: analysis,
        ai_analyzed_at: new Date().toISOString(),
        ai_analyzed_by: analyzedByUserId ?? null,
        ai_analysis_model: modelResult.model,
        ai_analysis_version: nextVersion,
        ai_analysis_error: null,
        ai_analysis_progress: "completed",
      },
    });

    await supabase.from("job_application_analysis_versions").upsert(
      {
        tenant_id: tenantId,
        application_id: jobApplicationId,
        version: nextVersion,
        analysis,
        score: analysis.candidate_match.recommended_overall_match_score,
        category: analysis.candidate_match.match_category,
        recommended_action: analysis.candidate_match.recommended_action,
        display_category:
          analysis.candidate_match.display_category ||
          analysis.candidate_match.match_category,
        model: modelResult.model,
        analyzed_by: analyzedByUserId ?? null,
        analyzed_at: new Date().toISOString(),
      },
      { onConflict: "application_id,version" }
    );

    emit("completed", "Match analysis complete", "ANALYZED");

    return {
      status: "ANALYZED",
      analysis,
      score: analysis.candidate_match.recommended_overall_match_score,
      category: analysis.candidate_match.match_category,
      action: analysis.candidate_match.recommended_action,
      readiness: analysis.submission_readiness.readiness_status,
      error: null,
      repaired: modelResult.repaired,
      model: modelResult.model,
    };
  } catch (error) {
    const message =
      error instanceof MatchAnalysisGenerationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Match analysis failed";

    emit("failed", message, "FAILED");
    await updateApplicationMatchFields({
      supabase,
      tenantId,
      jobApplicationId,
      patch: {
        ai_match_status: "FAILED",
        ai_analysis_progress: "failed",
        ai_analysis_error: message.slice(0, 2000),
      },
    }).catch(() => undefined);

    if (error instanceof MatchAnalysisGenerationError) throw error;
    throw error;
  }
}

export async function runMatchAnalysisBulk(args: {
  supabase: SupabaseClient;
  tenantId: string;
  jobApplicationIds: string[];
  onProgress?: (applicationId: string, event: MatchAnalysisProgressEvent) => void;
}): Promise<
  Array<{ jobApplicationId: string; result: RunMatchAnalysisResult | { status: "FAILED"; error: string } }>
> {
  const results: Array<{
    jobApplicationId: string;
    result: RunMatchAnalysisResult | { status: "FAILED"; error: string };
  }> = [];

  for (const id of args.jobApplicationIds) {
    try {
      const result = await runMatchAnalysisForApplication({
        supabase: args.supabase,
        tenantId: args.tenantId,
        jobApplicationId: id,
        onProgress: (event) => args.onProgress?.(id, event),
      });
      results.push({ jobApplicationId: id, result });
    } catch (error) {
      results.push({
        jobApplicationId: id,
        result: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Match analysis failed",
        },
      });
    }
  }

  return results;
}
