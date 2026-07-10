/** Recruiter / admin sign-in surfaces that should use tenant branding immediately. */
export function isRecruiterAuthPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signin" ||
    pathname.startsWith("/signin/")
  );
}
