"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Suspense } from "react";

function RoleSuccessContent() {
  const searchParams = useSearchParams();
  const roleKey = searchParams.get("role")?.trim() ?? "";
  const viewHref = roleKey
    ? `/admin_recruiter/settings/roles/${encodeURIComponent(roleKey)}`
    : "/admin_recruiter/settings/user-management";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#012352] text-white">
        <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold text-[#0F172A]">Success!</h1>
      <p className="mt-2 text-sm text-[#64748B]">New Role Added</p>
      <Link
        href={viewHref}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#012352] px-8 text-sm font-semibold text-white"
      >
        View
      </Link>
    </div>
  );
}

export default function RoleSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-[#64748B]">
          Loading…
        </div>
      }
    >
      <RoleSuccessContent />
    </Suspense>
  );
}
