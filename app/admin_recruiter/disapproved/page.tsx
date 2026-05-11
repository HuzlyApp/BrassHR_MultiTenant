import { StatusCandidatesPage } from "../components/StatusCandidatesPage";

export default function DisapprovedApplicantsPage() {
  return (
    <StatusCandidatesPage
      fetchUrl="/api/workers?status=disapproved"
      statusLabel="Disapproved"
      emptyMessage="No disapproved applicants found."
    />
  );
}

