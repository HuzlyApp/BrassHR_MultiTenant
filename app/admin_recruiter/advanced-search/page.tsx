import { redirect } from "next/navigation";

export default function AdvancedSearchPage() {
  redirect("/admin_recruiter/candidates?advancedSearch=1");
}
