"use client";

import { Loader2 } from "lucide-react";
import type { AdminEmailTemplateItem } from "@/lib/email-templates/types";
import { MailComposeDropdown } from "./MailComposeDropdown";
import { MailComposeFieldRow } from "./MailComposeFieldRow";
import { templateDisplayName } from "./useCandidateEmailTemplates";

type MailEmailTemplateSelectProps = {
  templates: AdminEmailTemplateItem[];
  loading: boolean;
  value: string;
  disabled?: boolean;
  previewLoading?: boolean;
  error?: string | null;
  onChange: (templateKey: string) => void;
};

export function MailEmailTemplateSelect({
  templates,
  loading,
  value,
  disabled = false,
  previewLoading = false,
  error = null,
  onChange,
}: MailEmailTemplateSelectProps) {
  const options = templates.map((template) => ({
    value: template.template_key,
    label: templateDisplayName(template),
    sublabel: template.is_tenant_override ? "Custom" : undefined,
  }));

  return (
    <MailComposeFieldRow label="Template">
      <div className="relative min-w-0">
        {previewLoading ? (
          <div className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-lg font-medium text-[#6B7280]">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-(--brand-primary)" />
            Loading template...
          </div>
        ) : (
          <MailComposeDropdown
            id="mail-compose-template"
            value={value}
            options={options}
            placeholder="No template"
            disabled={disabled}
            loading={loading}
            loadingLabel="Loading templates..."
            alignLabel="stacked"
            tallTrigger
            onChange={onChange}
          />
        )}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    </MailComposeFieldRow>
  );
}
