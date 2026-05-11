import { StatusCandidatesPage } from "../components/StatusCandidatesPage";

export default function ApprovedCandidatesPage() {
  return (
    <StatusCandidatesPage
      fetchUrl="/api/workers?status=approved"
      statusLabel="Approved"
      emptyMessage="No approved applicants found."
    />
  );
}

