"use client";

import { useParams } from "next/navigation";
import DetailedCandidateHeader from "../../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../../components/CandidateDetailLoader";
import ProfileSubTabs from "../../../../components/ProfileSubTabs";
import CandidateNotesPanel from "../../../../components/CandidateNotesPanel";
import { useCandidateHeader } from "../../../../hooks/useCandidateHeader";

export default function NewApplicantProfileNotesPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const {
    name: candidateName,
    role: candidateRole,
    status: candidateStatus,
    profilePhotoUrl,
    loading: headerLoading,
  } = useCandidateHeader(id);

  return (
    <div className="min-h-screen bg-zinc-50 admin-recruiter-page-pad">
      <div className="admin-recruiter-content-width">
        <DetailedTabs applicantId={id} activeTab="Profile" />

        {headerLoading ? (
          <CandidateDetailLoader label="Loading notes..." />
        ) : (
          <>
            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              status={candidateStatus}
              profilePhotoUrl={profilePhotoUrl}
            />
            <ProfileSubTabs applicantId={id} activeTab="Notes" />

            <div className="admin-recruiter-content-width">
              <CandidateNotesPanel
                workerId={id}
                candidateName={candidateName}
                layout="page"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
