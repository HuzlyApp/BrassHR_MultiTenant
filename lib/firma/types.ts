export type FirmaRecipientDesignation = "Signer" | "Approver" | "CC";

export type FirmaTemplateSettings = {
  allow_editing_before_sending?: boolean;
  attach_pdf_on_finish?: boolean;
  allow_download?: boolean;
  hand_drawn_only?: boolean;
  require_otp_verification?: boolean;
  disable_guided_navigation?: boolean;
  use_signing_order?: boolean;
};

export type FirmaTemplate = {
  id: string;
  name: string;
  description?: string | null;
  document_url?: string | null;
  document_url_expires_at?: string | null;
  date_created?: string;
  date_changed?: string;
  expiration_hours?: number;
  settings?: FirmaTemplateSettings;
};

export type FirmaTemplateUser = {
  id: string;
  first_name?: string;
  last_name?: string | null;
  email?: string;
  designation?: FirmaRecipientDesignation;
  order?: number;
};

export type FirmaTemplateField = {
  id: string;
  type?: string;
  variable_name?: string | null;
  required?: boolean;
  assigned_to_user_id?: string | null;
  page?: number;
};

export type FirmaJwtTokenResponse = {
  token: string;
  expires_at: string;
  jwt_record_id?: string;
};

export type FirmaSigningRequest = {
  id: string;
  name?: string;
  status?: string;
  recipients?: FirmaSigningRequestRecipient[];
  first_signer?: FirmaSigningRequestRecipient;
};

export type FirmaSigningRequestRecipient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  designation?: string | null;
  order?: number | null;
  status?: string | null;
  signing_url?: string | null;
  signing_link?: string | null;
};

export type FirmaApiErrorBody = {
  error?: string;
  message?: string;
  details?: unknown;
};

/** Workspace appearance settings (docs.firma.dev/guides/white-labeling). */
export type FirmaWorkspaceAppearanceSettings = {
  color_primary?: string | null;
  color_primary_fg?: string | null;
  color_background?: string | null;
  color_foreground?: string | null;
  color_card?: string | null;
  color_border?: string | null;
  color_accent?: string | null;
  color_accent_fg?: string | null;
  color_canvas?: string | null;
  color_muted?: string | null;
  color_muted_fg?: string | null;
};
