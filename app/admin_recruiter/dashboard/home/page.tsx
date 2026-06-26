import { redirect } from "next/navigation";
import { ADMIN_RECRUITER_HOME_ROUTE } from "@/app/admin_recruiter/components/sidebar-config";

export default function DashboardHomePage() {
  redirect(ADMIN_RECRUITER_HOME_ROUTE);
}
