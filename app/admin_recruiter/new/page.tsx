import { StatusCandidatesPage } from "../components/StatusCandidatesPage";

export default function NewCandidatesPage() {
  return (
    <StatusCandidatesPage
      fetchUrl="/api/workers?worker_status=new"
      statusLabel="New"
      emptyMessage="No new applicants found."
    />
  );
}

