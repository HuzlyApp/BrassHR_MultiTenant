import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import EmailTemplatesPanel from "@/app/admin_recruiter/components/EmailTemplatesPanel";

export default function AdminRecruiterEmailTemplatesPage() {
  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden max-[449px]:space-y-4">
      <div className="min-w-0 max-w-full">
        <Link
          href="/admin_recruiter/settings/templates"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Back to Templates
        </Link>
        <h1 className="text-xl font-semibold text-[#0F172A] max-[449px]:text-lg">Email Templates</h1>
        <p className="mt-2 max-w-full text-sm leading-5 text-[#64748B] max-[449px]:text-xs">
          Customize email content for your organization. Changes apply only to the current tenant
          and do not modify platform default templates.
        </p>
      </div>
      <EmailTemplatesPanel />
    </div>
  );
}
