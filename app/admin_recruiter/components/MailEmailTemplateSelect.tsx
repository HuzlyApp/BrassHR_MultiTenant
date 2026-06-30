"use client";

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
        {previewLoading ? null : (
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
