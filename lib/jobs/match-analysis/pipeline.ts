import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFullJobDescriptionText,
  buildStructuredJobRequirements,
  jobMetaFromRequisition,
  type JobRequisitionForRequirements,
} from "./build-job-requirements";
import {
  generateMatchAnalysis,
  generateFollowUpQuestions,
  MatchAnalysisGenerationError,
  matchAnalysisErrorCode,
} from "./service";
import { resolvePromptVersion } from "@/lib/ai-catalog/resolve-prompt";
import { PromptNotConfiguredError, PROMPT_NOT_CONFIGURED } from "@/lib/ai-catalog/errors";
import { recordAiPromptRun } from "@/lib/ai-catalog/record-run";
import { hashPromptInput } from "@/lib/ai-catalog/render-prompt";
import { industryKeyFromLegacyLabel } from "@/lib/ai-catalog/industry-catalog";
import { resolveResumeTextForMatch } from "./extract-resume-text";
import {
  cacheStructuredRequirements,
  persistMatchRequirements,
  updateApplicationMatchFields,
} from "./persist";
import { snapshotCurrentAnalysisVersion } from "./versions";
import type {
  AiMatchPipelineStatus,
  AnalysisMode,
  AnalysisProvider,
  MatchAnalysisResponse,
  PipelineProgressStep,
} from "./schema";
import { ANALYSIS_PROVIDER_LABELS, parseAnalysisMode, parseAnalysisProvider } from "./schema";
import {
  countQualificationOutcomes,
  listingRequirementOutcomeCounts,
  CALL_CONTEXT_QUESTION_KEY,
  formatScreeningPackForAiNotes,
  isCallContextQuestionKey,
  normalizeAnalysisScreeningQuestions,
  aiScreeningQuestionKey,
  matchSavedAiScreeningAnswer,
} from "./workspace";
import { applicationMatchScorePatch, isDeepMatchStage, matchStageFromMode } from "./match-stage";
import { fitBandFromQuickRoute, quickRouteFromAnalysis } from "./quick-route";
import {
  DEEP_MATCH_BLOCKED_LOW_FIT,
  canAdvanceMatchProgression,
  canRunDeepMatch,
  deepMatchBlockReason,
  matchProgressionIndexFromStage,
  quickMatchFitBand,
} from "./progression";
import { loadVerificationNotesForApplication } from "./verification-notes-service";
import { summarizeRequirementNotes } from "./verification-notes";
import {
  checklistFollowUpRows,
  mergeFollowUpQuestions,
} from "./follow-up-questions";

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
  requirementCounts: { confirmed: number; verify: number; notMet: number } | null;
  analyzedAt?: string | null;
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

export const FOLLOW_UP_BLOCKED_NOT_READY =
  "Run Quick Match before Verifications screening questions.";
/** @deprecated Use FOLLOW_UP_BLOCKED_NOT_READY — same gate for Step 2 call pack. */
export const CALL_PACK_BLOCKED_NOT_READY = FOLLOW_UP_BLOCKED_NOT_READY;

async function failedAnalysis(
  error: string,
  extra?: Partial<RunMatchAnalysisResult>
): Promise<RunMatchAnalysisResult> {
  return {
    status: "FAILED",
    analysis: null,
    score: null,
    category: null,
    action: null,
    readiness: null,
    error,
    repaired: false,
    model: null,
    requirementCounts: extra?.requirementCounts ?? null,
    ...extra,
  };
}

async function runCallPackQuestionsForApplication(args: {
  supabase: SupabaseClient;
  tenantId: string;
  jobApplicationId: string;
  analyzedByUserId?: string | null;
  analysisProvider: AnalysisProvider;
  application: {
    ai_match_status?: string | null;
    ai_match_stage?: string | null;
    ai_analysis?: unknown;
    recruiter_decision?: string | null;
    job_requisition_id?: string | null;
  };
  jobTitle: string;
  onProgress?: (event: MatchAnalysisProgressEvent) => void;
}): Promise<RunMatchAnalysisResult> {
  const {
    supabase,
    tenantId,
    jobApplicationId,
    analyzedByUserId,
    analysisProvider,
    application,
    jobTitle,
    onProgress,
  } = args;
  const emit = (step: PipelineProgressStep, message: string, status?: AiMatchPipelineStatus) => {
    onProgress?.({ step, message, status });
  };

  if (String(application.ai_match_status ?? "").toUpperCase() !== "ANALYZED") {
    return failedAnalysis("Run Quick Match before Verifications screening questions.");
  }
  if (isDeepMatchStage(application.ai_match_stage)) {
    return failedAnalysis("Screening questions run before Deep Match.");
  }
  const currentIndex = matchProgressionIndexFromStage(application.ai_match_stage);
  // Must have completed Quick Match (index 0). May re-run while still on Verifications.
  if (currentIndex > 1) {
    return failedAnalysis(
      "Screening questions are generated at Verifications (Step 2), before 2nd Follow-up."
    );
  }

  const { data: requirementRows, error: reqError } = await supabase
    .from("job_application_match_requirements")
    .select(
      "id, requirement_text, requirement_type, status, requirement_outcome, verification_required, recruiter_verified, recruiter_note"
    )
    .eq("tenant_id", tenantId)
    .eq("job_application_id", jobApplicationId)
    .order("sort_order", { ascending: true });
  if (reqError) throw reqError;

  const counts = countQualificationOutcomes(requirementRows ?? []);
  const storedRoute = quickRouteFromAnalysis(application.ai_analysis);
  const fitBand = storedRoute
    ? fitBandFromQuickRoute(storedRoute)
    : quickMatchFitBand({
        mandatory: counts.mandatory,
        confirmed: counts.confirmed,
        notMet: counts.notMet,
        blocking: counts.blocking,
      });
  const parked = application.recruiter_decision === "do_not_pursue";
  if (
    !canAdvanceMatchProgression({
      isAnalyzed: true,
      fitBand,
      parkedInTalentPool: parked,
    })
  ) {
    return failedAnalysis(
      parked ? "This candidate is in Talent Pool." : DEEP_MATCH_BLOCKED_LOW_FIT,
      { requirementCounts: listingRequirementOutcomeCounts(requirementRows ?? []) }
    );
  }

  const notes = await loadVerificationNotesForApplication(supabase, tenantId, jobApplicationId);
  const summaries = summarizeRequirementNotes(notes);
  const existingAnalysis =
    application.ai_analysis &&
    typeof application.ai_analysis === "object" &&
    !Array.isArray(application.ai_analysis)
      ? (application.ai_analysis as Record<string, unknown>)
      : null;
  if (!existingAnalysis) {
    return failedAnalysis("Run Quick Match before Verifications screening questions.");
  }
  const blockingTexts = Array.isArray(
    (existingAnalysis.submission_readiness as { blocking_requirements?: unknown } | undefined)
      ?.blocking_requirements
  )
    ? (
        (existingAnalysis.submission_readiness as { blocking_requirements: unknown[] })
          .blocking_requirements
      )
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];

  const checklist = checklistFollowUpRows(
    (requirementRows ?? []).map((row) => {
      const summary = summaries.get(String(row.id));
      return {
        requirement_text: String(row.requirement_text ?? ""),
        requirement_type: String(row.requirement_type ?? ""),
        status: String(row.status ?? ""),
        requirement_outcome: String(row.requirement_outcome ?? ""),
        verification_required: Boolean(row.verification_required),
        recruiter_verified: Boolean(row.recruiter_verified),
        recruiter_note: (row.recruiter_note as string | null) ?? null,
        latest_verification_note: summary?.latestNote
          ? {
              id: summary.latestNote.id,
              noteBody: summary.latestNote.noteBody,
              candidateQuestion: summary.latestNote.candidateQuestion,
              dueDate: summary.latestNote.dueDate,
              verificationStatus: summary.latestNote.verificationStatus,
              candidateResponse: summary.latestNote.candidateResponse,
              createdByName: summary.latestNote.createdByName,
              updatedByName: summary.latestNote.updatedByName,
              createdAt: summary.latestNote.createdAt,
              updatedAt: summary.latestNote.updatedAt,
            }
          : null,
      };
    }),
    blockingTexts
  );

  emit("analyzing", "Writing Verifications screening questions (Grok Fast → Gemini Lite)", "ANALYZING");
  await updateApplicationMatchFields({
    supabase,
    tenantId,
    jobApplicationId,
    patch: {
      ai_match_status: "ANALYZING",
      ai_analysis_progress: "analyzing",
      ai_analysis_error: null,
    },
  });

  try {
    const generated = await generateFollowUpQuestions(
      { jobTitle, checklist },
      analysisProvider
    );
    const merged = mergeFollowUpQuestions(existingAnalysis, generated.questions);
    const previousVersion = await snapshotCurrentAnalysisVersion({
      supabase,
      tenantId,
      applicationId: jobApplicationId,
      analyzedBy: analyzedByUserId ?? null,
    });
    const analyzedAt = new Date().toISOString();
    await updateApplicationMatchFields({
      supabase,
      tenantId,
      jobApplicationId,
      patch: {
        ai_match_status: "ANALYZED",
        ai_match_stage: "call_pack",
        ai_analysis: merged,
        ai_analyzed_at: analyzedAt,
        ai_analyzed_by: analyzedByUserId ?? null,
        ai_analysis_model: generated.model,
        ai_analysis_version: previousVersion + 1,
        ai_analysis_error: null,
        ai_analysis_progress: "completed",
      },
    });
    emit("completed", "Verifications screening questions ready", "ANALYZED");
    return {
      status: "ANALYZED",
      analysis: merged as unknown as MatchAnalysisResponse,
      score: null,
      category: null,
      action: null,
      readiness: null,
      error: null,
      repaired: generated.repaired,
      model: generated.model,
      requirementCounts: listingRequirementOutcomeCounts(requirementRows ?? []),
      analyzedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not write Verifications screening questions.";
    await updateApplicationMatchFields({
      supabase,
      tenantId,
      jobApplicationId,
      patch: {
        ai_match_status: "ANALYZED",
        ai_analysis_progress: "failed",
        ai_analysis_error: message.slice(0, 2000),
      },
    });
    throw error;
  }
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
  /** Lean Analyze (default) or Deeper Analysis prompt/schema. */
  analysisMode?: AnalysisMode;
  /** Grok (default) or Gemini. */
  analysisProvider?: AnalysisProvider;
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
  const analysisMode = parseAnalysisMode(args.analysisMode);
  const analysisProvider = parseAnalysisProvider(args.analysisProvider);
  const providerLabel = ANALYSIS_PROVIDER_LABELS[analysisProvider];

  const emit = (step: PipelineProgressStep, message: string, status?: AiMatchPipelineStatus) => {
    onProgress?.({ step, message, status });
  };

  const { data: application, error: appError } = await supabase
    .from("job_applications")
    .select(
      "id, tenant_id, job_requisition_id, worker_id, applicant_profile_id, ai_match_status, ai_match_stage, ai_analysis, recruiter_decision"
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
      requirementCounts: null,
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("job_requisitions")
    .select(
      "id, public_title, qualifications, responsibilities, public_description, special_requirements, required_credentials, years_of_experience, years_experience_required, location, specialty, msp_client, msp_name, facility, facility_name, structured_requirements, ai_match_enabled, industry_key, job_source_id, professions(name), specialties(name)"
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
      requirementCounts: null,
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
      requirementCounts: null,
    };
  }

  if (analysisMode === "call_pack" || analysisMode === "follow_up") {
    const jobTitle =
      typeof job.public_title === "string" && job.public_title.trim()
        ? job.public_title
        : "Job";
    return runCallPackQuestionsForApplication({
      supabase,
      tenantId,
      jobApplicationId,
      analyzedByUserId,
      analysisProvider,
      application,
      jobTitle,
      onProgress,
    });
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
        requirementCounts: null,
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

    {
      const { data: screeningRows } = await supabase
        .from("job_application_ai_screening_answers")
        .select("question_key, question_text, answer_text")
        .eq("tenant_id", tenantId)
        .eq("application_id", jobApplicationId);
      const byKey = new Map(
        (screeningRows ?? []).map((row) => [String(row.question_key), row])
      );
      const callContext =
        String(byKey.get(CALL_CONTEXT_QUESTION_KEY)?.answer_text ?? "").trim() || "";
      const analysisQuestions = normalizeAnalysisScreeningQuestions(
        (application.ai_analysis as MatchAnalysisResponse | null)?.screening_questions
      );
      const packQuestions = analysisQuestions.map((question) => {
        const key = aiScreeningQuestionKey(question.priority, question.question);
        const saved = matchSavedAiScreeningAnswer(byKey, key, question.question);
        return {
          question: question.question,
          answer: isCallContextQuestionKey(key) ? "" : saved?.answer_text ?? "",
        };
      });
      const packNotes = formatScreeningPackForAiNotes({
        questions: packQuestions,
        callContext,
      });
      if (packNotes) {
        notes = notes ? `${notes}\n\n${packNotes}` : packNotes;
      }
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

    if (analysisMode === "deep") {
      const { data: existingReqs } = await supabase
        .from("job_application_match_requirements")
        .select(
          "requirement_type, status, requirement_outcome, verification_required, recruiter_verified"
        )
        .eq("tenant_id", tenantId)
        .eq("job_application_id", jobApplicationId);
      const counts = countQualificationOutcomes(existingReqs ?? []);
      const storedRoute = quickRouteFromAnalysis(application.ai_analysis);
      const fitBand = storedRoute
        ? fitBandFromQuickRoute(storedRoute)
        : quickMatchFitBand({
            mandatory: counts.mandatory,
            confirmed: counts.confirmed,
            notMet: counts.notMet,
            blocking: counts.blocking,
          });
      const unlockedIndex = matchProgressionIndexFromStage(application.ai_match_stage);
      const blocked = deepMatchBlockReason({
        isAnalyzed: true,
        fitBand,
        unlockedIndex,
      });
      if (blocked || !canRunDeepMatch({ isAnalyzed: true, fitBand, unlockedIndex })) {
        const message = blocked || DEEP_MATCH_BLOCKED_LOW_FIT;
        emit("failed", message, "FAILED");
        await updateApplicationMatchFields({
          supabase,
          tenantId,
          jobApplicationId,
          patch: {
            ai_match_status: application.ai_match_status ?? "ANALYZED",
            ai_analysis_progress: "failed",
            ai_analysis_error: message,
          },
        });
        return {
          status: "FAILED",
          analysis: null,
          score: null,
          category: null,
          action: null,
          readiness: null,
          error: message,
          repaired: false,
          model: null,
          requirementCounts: {
            confirmed: counts.confirmed,
            verify: counts.verify,
            notMet: counts.notMet,
          },
        };
      }
    }

    emit(
      "analyzing",
      analysisMode === "deep"
        ? `Running Deep Match (${providerLabel})`
        : `Running Quick Match (${providerLabel})`,
      "ANALYZING"
    );
    await setProgress(supabase, tenantId, jobApplicationId, "analyzing");

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("primary_industry_key, industry")
      .eq("id", tenantId)
      .maybeSingle();

    const jobIndustryKey =
      typeof job.industry_key === "string" && job.industry_key.trim()
        ? String(job.industry_key)
        : null;
    const tenantPrimary =
      typeof tenantRow?.primary_industry_key === "string" && tenantRow.primary_industry_key.trim()
        ? String(tenantRow.primary_industry_key)
        : industryKeyFromLegacyLabel(
            typeof tenantRow?.industry === "string" ? tenantRow.industry : null
          );

    const startedAt = Date.now();
    let clientName =
      typeof job.msp_client === "string" && job.msp_client.trim()
        ? job.msp_client
        : typeof job.msp_name === "string" && job.msp_name.trim()
          ? job.msp_name
          : null;
    let sourceKey =
      typeof job.msp_name === "string" && job.msp_name.trim() ? job.msp_name : null;
    const jobSourceId =
      typeof job.job_source_id === "string" && job.job_source_id.trim()
        ? job.job_source_id
        : null;
    if (jobSourceId) {
      const { data: sourceRow } = await supabase
        .from("job_sources")
        .select("name, code")
        .eq("id", jobSourceId)
        .maybeSingle();
      if (typeof sourceRow?.name === "string" && sourceRow.name.trim()) {
        clientName = sourceRow.name;
      }
      if (typeof sourceRow?.code === "string" && sourceRow.code.trim()) {
        sourceKey = sourceRow.code;
      }
    }

    let resolved = null;
    if (analysisMode === "deep") {
      try {
        resolved = await resolvePromptVersion(supabase, {
          tenantId,
          featureKey: "candidate_match",
          variantKey: "deep",
          industryKey: jobIndustryKey,
          tenantPrimaryIndustryKey: tenantPrimary,
          clientName,
          sourceKey,
        });
      } catch (error) {
        if (error instanceof PromptNotConfiguredError) {
          await recordAiPromptRun(supabase, {
            tenantId,
            featureKey: "candidate_match",
            variantKey: "deep",
            verticalKey: null,
            industryKey: jobIndustryKey ?? tenantPrimary,
            promptVersionId: null,
            contentHash: null,
            entityType: "job_application",
            entityId: jobApplicationId,
            inputHash: hashPromptInput({
              jobDescription: fullJd,
              resumeText: resume.sanitized,
              recruiterNotes: notes,
            }),
            model: null,
            inputTokens: null,
            outputTokens: null,
            latencyMs: Date.now() - startedAt,
            creditCost: null,
            status: "skipped_no_prompt",
            errorCode: PROMPT_NOT_CONFIGURED,
            outputReference: null,
            requestedBy: analyzedByUserId ?? null,
          }).catch(() => undefined);
          emit("failed", error.message, "FAILED");
          await updateApplicationMatchFields({
            supabase,
            tenantId,
            jobApplicationId,
            patch: {
              ai_match_status: "FAILED",
              ai_analysis_progress: "failed",
              ai_analysis_error: error.message.slice(0, 2000),
            },
          });
          return {
            status: "FAILED",
            analysis: null,
            score: null,
            category: null,
            action: null,
            readiness: null,
            error: PROMPT_NOT_CONFIGURED,
            repaired: false,
            model: null,
            requirementCounts: null,
          };
        }
        throw error;
      }
    }

    const modelResult = await generateMatchAnalysis(
      {
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
        analysisMode,
      },
      resolved,
      analysisProvider
    );

    emit("validating", "Validating and rescoring", "ANALYZING");
    await setProgress(supabase, tenantId, jobApplicationId, "validating");

    const analysis = modelResult.analysis;

    emit("saving", "Saving analysis results", "ANALYZING");
    await setProgress(supabase, tenantId, jobApplicationId, "saving");

    const persistedRequirements = await persistMatchRequirements({
      supabase,
      tenantId,
      jobApplicationId,
      analysis,
    });

    const analyzedAt = new Date().toISOString();
    const stage = matchStageFromMode(analysisMode);
    const scorePatch = applicationMatchScorePatch({ stage, analysis });
    const persistedScore =
      stage === "deep" ? analysis.candidate_match.recommended_overall_match_score : null;

    await updateApplicationMatchFields({
      supabase,
      tenantId,
      jobApplicationId,
      patch: {
        ai_match_status: "ANALYZED",
        ...scorePatch,
        ai_analysis_raw: modelResult.rawObject,
        ai_analysis: analysis,
        ai_analyzed_at: analyzedAt,
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
        score: persistedScore,
        category: analysis.candidate_match.match_category || null,
        recommended_action:
          stage === "deep" ? analysis.candidate_match.recommended_action : null,
        display_category:
          analysis.candidate_match.display_category?.trim() ||
          analysis.candidate_match.match_category ||
          null,
        model: modelResult.model,
        analyzed_by: analyzedByUserId ?? null,
        analyzed_at: analyzedAt,
        prompt_version_id: resolved?.promptVersionId ?? null,
        prompt_content_hash: resolved?.contentHash ?? null,
      },
      { onConflict: "application_id,version" }
    );

    await recordAiPromptRun(supabase, {
      tenantId,
      featureKey: "candidate_match",
      variantKey: resolved?.variantKey ?? (analysisMode === "deep" ? "deep" : "default"),
      verticalKey: resolved?.resolvedVerticalKey ?? null,
      industryKey: resolved?.requestedIndustryKey ?? jobIndustryKey ?? tenantPrimary,
      promptVersionId: resolved?.promptVersionId ?? null,
      contentHash: resolved?.contentHash ?? "hardcoded:quick_match",
      entityType: "job_application",
      entityId: jobApplicationId,
      inputHash: hashPromptInput({
        jobDescription: fullJd,
        resumeText: resume.sanitized,
        recruiterNotes: notes,
      }),
      model: modelResult.model,
      inputTokens: null,
      outputTokens: null,
      latencyMs: Date.now() - startedAt,
      creditCost: null,
      status: "success",
      errorCode: null,
      outputReference: `${jobApplicationId}:${nextVersion}`,
      requestedBy: analyzedByUserId ?? null,
    });

    emit("completed", "Match analysis complete", "ANALYZED");

    return {
      status: "ANALYZED",
      analysis,
      score: persistedScore,
      category: stage === "deep" ? analysis.candidate_match.match_category : null,
      action: stage === "deep" ? analysis.candidate_match.recommended_action : null,
      readiness:
        stage === "deep" ? analysis.submission_readiness.readiness_status : null,
      error: null,
      repaired: modelResult.repaired,
      model: modelResult.model,
      requirementCounts: listingRequirementOutcomeCounts(persistedRequirements),
      analyzedAt,
    };
  } catch (error) {
    const message =
      error instanceof MatchAnalysisGenerationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Match analysis failed";

    emit("failed", message, "FAILED");
    await recordAiPromptRun(supabase, {
      tenantId,
      featureKey: "candidate_match",
      variantKey: analysisMode === "deep" ? "deep" : "default",
      verticalKey: null,
      industryKey: null,
      promptVersionId: null,
      contentHash: null,
      entityType: "job_application",
      entityId: jobApplicationId,
      inputHash: null,
      model: null,
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      creditCost: null,
      status: "failed",
      errorCode: matchAnalysisErrorCode(error),
      outputReference: null,
      requestedBy: analyzedByUserId ?? null,
    }).catch(() => undefined);
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
  analyzedByUserId?: string | null;
  analysisMode?: AnalysisMode;
  analysisProvider?: AnalysisProvider;
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
        analyzedByUserId: args.analyzedByUserId,
        analysisMode: args.analysisMode,
        analysisProvider: args.analysisProvider,
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
