import { StatusCandidatesPage } from "../components/StatusCandidatesPage";

export default function PreApprovalCandidatesPage() {
  return (
    <StatusCandidatesPage
      fetchUrl="/api/workers?status=for_approval"
      statusLabel="For Approval"
      emptyMessage="No candidates awaiting approval."
    />
  );
}
