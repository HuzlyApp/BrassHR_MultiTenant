import { redirect } from "next/navigation";

/** Alias for recruiter sign-in (`/login`). */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = sp.next;
  const tenant = sp.tenant;
  const error = sp.error;

  const params = new URLSearchParams();
  if (typeof next === "string") params.set("next", next);
  if (typeof tenant === "string") params.set("tenant", tenant);
  if (typeof error === "string") params.set("error", error);

  const qs = params.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}
