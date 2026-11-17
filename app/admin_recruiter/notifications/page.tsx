import { redirect } from "next/navigation";

/** Notifications settings live under Personal Settings account tabs. */
export default function AdminRecruiterNotificationsPage() {
  redirect("/admin_recruiter/account/notifications");
}
