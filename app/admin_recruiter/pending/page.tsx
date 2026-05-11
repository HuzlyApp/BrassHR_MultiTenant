import { StatusCandidatesPage } from "../components/StatusCandidatesPage";

export default function PendingCandidatesPage() {
  return (
    <StatusCandidatesPage
      fetchUrl="/api/workers?status=pending"
      statusLabel="Pending"
      emptyMessage="No pending applicants found."
    />
  );
}

