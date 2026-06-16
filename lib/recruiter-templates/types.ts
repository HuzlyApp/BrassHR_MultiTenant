import type {
  AppDataSource,
  RecruiterTemplateCategory,
  RecruiterTemplateDesignation,
  RecruiterTemplateFieldType,
  RecruiterTemplateStatus,
  SigningRoleKey,
} from "@/lib/recruiter-templates/constants";

export type RecruiterTemplateRoleRow = {
  id: string;
  template_id: string;
  role_key: SigningRoleKey;
  label: string;
  designation: RecruiterTemplateDesignation;
  signing_order: number;
  firma_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RecruiterTemplateFieldRow = {
  id: string;
  template_id: string;
  variable_name: string;
  label: string;
  field_type: RecruiterTemplateFieldType;
  app_data_source: AppDataSource;
  assigned_role_key: SigningRoleKey | null;
  firma_field_id: string | null;
  required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RecruiterTemplateRow = {
  id: string;
  tenant_id: string;
  firma_template_id: string | null;
  firma_builder_session_id?: string | null;
  name: string;
  description: string | null;
  category: RecruiterTemplateCategory;
  status: RecruiterTemplateStatus;
  document_file_name: string | null;
  document_storage_path: string | null;
  expiration_hours: number;
  firma_settings: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type RecruiterTemplateDetail = RecruiterTemplateRow & {
  roles: RecruiterTemplateRoleRow[];
  fields: RecruiterTemplateFieldRow[];
};

export type RecruiterTemplateListItem = Pick<
  RecruiterTemplateRow,
  | "id"
  | "name"
  | "description"
  | "category"
  | "status"
  | "firma_template_id"
  | "document_file_name"
  | "created_at"
  | "updated_at"
  | "published_at"
>;

export type RecruiterTemplatePreview = {
  template: RecruiterTemplateDetail;
  firma?: {
    document_url?: string | null;
    document_url_expires_at?: string | null;
    users?: Array<{ id: string; label: string; designation?: string; order?: number }>;
    fields?: Array<{ id: string; variable_name?: string | null; type?: string; required?: boolean }>;
  };
  editor?: {
    jwt?: string;
    expires_at?: string;
    builder_session_id?: string | null;
    editor_url?: string;
    embed_script_url: string;
    editor_app_url: string;
  };
};

export type RecruiterTemplateBuilderSession = {
  template: RecruiterTemplateDetail;
  firma_template_id: string;
  builder_session_id: string | null;
  jwt: string;
  editor_url: string;
  editor_app_url: string;
  embed_script_url: string;
  expires_at: string;
};

export type RecruiterTemplateSyncInput = {
  event?: "editor.saved" | "editor.published" | "editor.closed";
  firma_template_id?: string;
  updated_at?: string;
  draft?: boolean;
};

export type RecruiterTemplateRoleInput = {
  role_key: SigningRoleKey;
  label: string;
  designation?: RecruiterTemplateDesignation;
  signing_order: number;
};

export type RecruiterTemplateFieldInput = {
  variable_name: string;
  label: string;
  field_type?: RecruiterTemplateFieldType;
  app_data_source: AppDataSource;
  assigned_role_key?: SigningRoleKey | null;
  required?: boolean;
  sort_order?: number;
};

export type SaveRecruiterTemplateInput = {
  name: string;
  description?: string | null;
  category: RecruiterTemplateCategory;
  expiration_hours?: number;
  roles: RecruiterTemplateRoleInput[];
  fields: RecruiterTemplateFieldInput[];
  document_file_name?: string | null;
  document_storage_path?: string | null;
};

export type ListRecruiterTemplatesFilters = {
  status?: RecruiterTemplateStatus;
  category?: RecruiterTemplateCategory;
  search?: string;
};
