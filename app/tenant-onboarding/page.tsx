import { redirect } from "next/navigation";
import { OWNER_WORKSPACE_PREPARATION_ROUTE } from "@/lib/signup/smb-post-signup";

/** Legacy setup links now prepare the workspace and continue to Launch Pad. */
export default function TenantOnboardingPage() {
  redirect(OWNER_WORKSPACE_PREPARATION_ROUTE);
}
