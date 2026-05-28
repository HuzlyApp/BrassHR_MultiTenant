import { redirect } from "next/navigation";

export default function GodAdminIndexPage() {
  redirect("/godadmin/tenants");
}
