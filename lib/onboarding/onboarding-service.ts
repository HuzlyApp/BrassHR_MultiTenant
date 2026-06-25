/**
 * Central onboarding data access for Supabase-backed libraries, templates, flows, and steps.
 */
export {
  listOnboardingLibraries,
  createOnboardingLibrary,
  getOnboardingLibraryById,
  type OnboardingLibraryRow,
  type OnboardingLibraryListItem,
} from "@/lib/onboarding/onboarding-libraries";

export {
  listOnboardingFlows,
  getOnboardingFlowById,
  createOnboardingFlow,
  updateOnboardingFlow,
  deleteOnboardingFlow,
  saveOnboardingFlowAsTemplate,
  type OnboardingFlowRow,
  type OnboardingFlowListItem,
} from "@/lib/onboarding/onboarding-flows";

export {
  listWorkflowTemplates,
  getWorkflowTemplateById,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  workflowTemplateDraft,
  type WorkflowTemplateListItem,
} from "@/lib/onboarding/workflow-templates";

export { loadOnboardingStepLibrary } from "@/lib/onboarding/load-step-library";

export {
  loadFlowBuilderDraft,
  loadTemplateBuilderDraft,
  replaceFlowStepsFromDraft,
} from "@/lib/onboarding/flow-steps-sync";
