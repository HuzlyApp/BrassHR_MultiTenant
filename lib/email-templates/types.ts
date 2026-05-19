export type EmailTemplateStatus = "draft" | "active" | "archived";

export type EmailTemplateVariable = {
  key: string;
  required?: boolean;
  description?: string;
  sample?: string;
};

export type EmailTemplateRow = {
  id: string;
  tenant_id: string | null;
  template_key: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: EmailTemplateVariable[];
  locale: string;
  status: EmailTemplateStatus;
  version: number;
  is_active_version: boolean;
  source_global_template_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type TemplateResolutionSource = "tenant" | "global";

export type ResolvedEmailTemplate = {
  template: EmailTemplateRow;
  resolved_from: TemplateResolutionSource;
  locale_used: string;
};

export type AdminEmailTemplateItem = {
  template_key: string;
  name: string;
  locale: string;
  variables: EmailTemplateVariable[];
  resolved_from: TemplateResolutionSource;
  tenant_template_id: string | null;
  is_tenant_override: boolean;
  subject: string;
  body_html: string;
  body_text: string | null;
  version: number;
  status: EmailTemplateStatus;
};
