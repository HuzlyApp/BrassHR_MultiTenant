"use client";

import { WorkerTicketsKnowledgebaseClient } from "@/app/application/components/applicant-portal/WorkerTicketsKnowledgebaseClient";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantTicketsKnowledgebasePage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerTicketsKnowledgebaseClient />
    </ApplicantPortalRoutePage>
  );
}
