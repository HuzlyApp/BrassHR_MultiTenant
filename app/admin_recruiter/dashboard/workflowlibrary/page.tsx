"use client";

import { WorkflowLibraryPage } from "@/app/braas-hr/dashboard/workflowlibrary/WorkflowLibraryPage";

export default function AdminRecruiterWorkflowLibraryPage() {
  return <WorkflowLibraryPage dashboardBasePath="/admin_recruiter/dashboard" embeddedInAdminShell />;
}
