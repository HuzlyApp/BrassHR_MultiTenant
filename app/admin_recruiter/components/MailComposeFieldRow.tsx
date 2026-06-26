"use client";

import type { ReactNode } from "react";

type MailComposeFieldRowProps = {
  label: string;
  children: ReactNode;
};

/** Label + control on one row for compose (Candidate, Template, etc.). */
export function MailComposeFieldRow({ label, children }: MailComposeFieldRowProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 text-lg font-semibold leading-tight text-[#374151]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
