import type { ReactNode } from "react";
import { ApplicantPortalProvider } from "@/app/application/components/applicant-portal/ApplicantPortalProvider";

export default function ApplicantHomeLayout({ children }: { children: ReactNode }) {
  return <ApplicantPortalProvider>{children}</ApplicantPortalProvider>;
}
