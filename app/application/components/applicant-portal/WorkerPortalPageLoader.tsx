"use client";

import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";

type Props = {
  label?: string;
  className?: string;
};

/** Centers loading state in the worker portal main area (below header, beside sidebar). */
export function WorkerPortalPageLoader({ label, className }: Props) {
  return <DashboardPageLoader label={label} layout="page" className={className} />;
}
