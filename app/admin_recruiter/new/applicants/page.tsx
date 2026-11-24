import { redirect } from "next/navigation";

/** Legacy applicants list URL — keep redirects working for old bookmarks/handoffs. */
export default function LegacyApplicantsPage() {
  redirect("/admin_recruiter/applications");
}
