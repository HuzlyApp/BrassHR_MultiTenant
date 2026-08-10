export {
  MATCH_CATEGORIES,
  RECOMMENDED_ACTIONS,
  READINESS_STATUSES,
  REQUIREMENT_STATUSES,
  REQUIREMENT_OUTCOMES,
  AI_MATCH_PIPELINE_STATUSES,
  MATCH_CATEGORY_LABELS,
  RECOMMENDED_ACTION_LABELS,
  MATCH_ANALYSIS_ERROR,
  matchAnalysisResponseSchema,
  requirementItemSchema,
  structuredJobRequirementsSchema,
  type MatchAnalysisResponse,
  type RequirementItem,
  type StructuredJobRequirements,
  type MatchCategory,
  type RecommendedAction,
  type AiMatchPipelineStatus,
  type PipelineProgressStep,
} from "./schema";

export {
  MATCH_ANALYSIS_SYSTEM_PROMPT,
  MATCH_ANALYSIS_RESPONSE_SCHEMA_TEXT,
  buildMatchAnalysisUserPrompt,
  buildMatchAnalysisRepairPrompt,
} from "./prompts";

export { sanitizeResumeForMatchAnalysis, normalizeResumeWhitespace } from "./sanitize-resume";
export { parseAndValidateMatchAnalysis } from "./parse";
export { rescoreMatchAnalysis, applyFairnessOutcomes } from "./score";
export {
  buildStructuredJobRequirements,
  buildFullJobDescriptionText,
  jobMetaFromRequisition,
} from "./build-job-requirements";
export { resolveResumeTextForMatch } from "./extract-resume-text";
export {
  generateMatchAnalysisWithGrok,
  getMatchAnalysisModelName,
  MatchAnalysisGenerationError,
  __setGrokClientForTests,
} from "./service";
export {
  runMatchAnalysisForApplication,
  runMatchAnalysisBulk,
  type RunMatchAnalysisResult,
  type MatchAnalysisProgressEvent,
} from "./pipeline";
