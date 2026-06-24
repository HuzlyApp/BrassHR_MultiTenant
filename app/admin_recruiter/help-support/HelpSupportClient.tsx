"use client";

import AdminFaqBrowser from "@/app/admin_recruiter/components/AdminFaqBrowser";
import { CandidatesPageHeader } from "@/app/admin_recruiter/components/CandidatesPageHeader";

export default function HelpSupportClient() {
  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <CandidatesPageHeader
        variant="page"
        title="Help & Support"
        subtitle="Find answers to common questions about brassHR"
      />

      <AdminFaqBrowser
        variant="cards"
        loadingLabel="Loading help articles..."
        emptyConfiguredMessage="No FAQ articles are available yet."
      />
    </div>
  );
}
