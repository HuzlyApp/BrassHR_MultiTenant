"use client";

import { useParams } from "next/navigation";
import { useCandidateDetailChromeActive } from "../../../components/CandidateDetailChrome";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../components/CandidateDetailLoader";
import CandidateLicenseCertificationsPanel from "../../../components/CandidateLicenseCertificationsPanel";
import { useCandidateHeader } from "../../../hooks/useCandidateHeader";

export default function CandidateLicensesPage() {
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;
  const chromeActive = useCandidateDetailChromeActive();
  const { loading, worker, name, role, status, profilePhotoUrl, email } =
    useCandidateHeader(applicantId);

  if (!applicantId) {
    return (
      <div className="admin-recruiter-page-pad">
        <p className="text-sm text-red-700">Missing candidate id.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 w-full min-w-0 overflow-auto admin-recruiter-page-pad">
          <div className="admin-recruiter-content-width">
            {loading && !chromeActive ? (
              <CandidateDetailLoader label="Loading licenses..." />
            ) : (
              <>
                {!chromeActive ? (
                  <>
                    <DetailedCandidateHeader
                      name={name}
                      role={role}
                      profilePhotoUrl={profilePhotoUrl ?? worker?.profile_photo_url}
                      workerId={applicantId}
                      candidateEmail={email ?? worker?.email ?? null}
                    />
                    <DetailedTabs
                      applicantId={applicantId}
                      activeTab="Licenses & Certifications"
                      workerStatus={status ?? null}
                    />
                  </>
                ) : null}

                {loading ? (
                  <CandidateDetailLoader label="Loading licenses..." />
                ) : (
                  <CandidateLicenseCertificationsPanel workerId={applicantId} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
