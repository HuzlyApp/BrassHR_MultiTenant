import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin_recruiter/mail?compose=1");
}
