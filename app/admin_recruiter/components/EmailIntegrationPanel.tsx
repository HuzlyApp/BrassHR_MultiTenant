"use client";

import { useRouter } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

type EmailIntegrationPanelProps = {
  emailConfigured: boolean;
  onManageTemplates?: () => void;
};

export function EmailIntegrationPanel({
  emailConfigured,
  onManageTemplates,
}: EmailIntegrationPanelProps) {
  const router = useRouter();
  const branding = useTenantBranding();
  const companyName = branding.companyName?.trim() || "your organization";

  const goTemplates = () => {
    if (onManageTemplates) onManageTemplates();
    else router.push("/admin_recruiter/email-templates");
  };

  if (emailConfigured) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
        <h3 className="text-lg font-semibold text-[#111827]">Email is connected</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6B7280]">
          Your organization email is set up through {companyName}. You can send emails to candidates
          and manage templates below.
        </p>
        <button
          type="button"
          onClick={goTemplates}
          className="mt-8 rounded-lg bg-(--brand-primary) px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Manage email templates
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <h3 className="text-lg font-semibold text-[#111827]">
        Integrate your Google or Outlook email
      </h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6B7280]">
        Integrating your email will allow you to seamlessly send and receive emails from candidates
        in your database directly within {companyName}.
      </p>
      <button
        type="button"
        onClick={goTemplates}
        className="mt-2 text-sm font-medium text-(--brand-primary) hover:underline"
      >
        Learn more about email integrations
      </button>
      <button
        type="button"
        onClick={goTemplates}
        className="mt-8 rounded-lg bg-(--brand-primary) px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Integrate your email
      </button>
    </div>
  );
}
