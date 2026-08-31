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
  analyzeMatchResponseSchema,
  requirementItemSchema,
  structuredJobRequirementsSchema,
  type MatchAnalysisResponse,
  type AnalyzeMatchResponse,
  type RequirementItem,
  type StructuredJobRequirements,
  type MatchCategory,
  type RecommendedAction,
  type AnalysisMode,
  type AiMatchPipelineStatus,
  type PipelineProgressStep,
} from "./schema";

export {
  ANALYZE_SYSTEM_PROMPT,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
  MATCH_ANALYSIS_SYSTEM_PROMPT,
  ANALYZE_RESPONSE_SCHEMA,
  MATCH_ANALYSIS_RESPONSE_SCHEMA_TEXT,
  systemPromptForMode,
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
