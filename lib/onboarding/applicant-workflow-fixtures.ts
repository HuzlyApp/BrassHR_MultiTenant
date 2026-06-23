import type { PublishedWorkflow } from "@/lib/onboarding/applicant-workflow-types";

export const publishedWorkflow: PublishedWorkflow = {
  workflowId: "worker_onboarding",
  tenant: "subdomaintest",
  version: 3,
  status: "published",
  steps: [
    {
      id: "step_skill_assessment",
      type: "skill_qualification_assessment",
      title: "Skill / Qualification Assessment",
      description: "",
      required: true,
      day: 1,
      order: 1,
      settings: {},
    },
    {
      id: "step_document_upload",
      type: "document_upload",
      title: "Document Upload",
      description: "",
      required: true,
      day: 2,
      order: 2,
      settings: {},
    },
    {
      id: "step_background_check",
      type: "background_check",
      title: "Background Check",
      description: "Track background check completion.",
      required: true,
      day: 3,
      order: 3,
      settings: {
        clientPerforms: true,
        useIntegrationPartner: true,
        provider: "checker",
        triggerAfter: "offer_acceptance",
        notify: ["hr", "recruiter"],
        timeline: "5_business_days",
        notifyHrOnFail: true,
      },
    },
  ],
};
