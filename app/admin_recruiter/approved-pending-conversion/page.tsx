import { redirect } from "next/navigation";

/** Legacy Pending Conversion route — conversion lives on Approved / Onboarded. */
export default function ApprovedPendingConversionRedirectPage() {
  redirect("/admin_recruiter/approved");
}
