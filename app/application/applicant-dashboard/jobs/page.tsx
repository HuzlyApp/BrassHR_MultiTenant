import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerJobsClient } from "@/app/application/components/applicant-portal/WorkerJobsClient";

export default function WorkerJobsPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerJobsClient />
    </ApplicantPortalRoutePage>
  );
}
