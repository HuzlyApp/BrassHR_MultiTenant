import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createFirmaSigningRequest,
  createFirmaTemplate,
  deleteFirmaTemplate,
  duplicateFirmaTemplateToSigningRequest,
  generateFirmaTemplateJwt,
  getFirmaEmbedScriptUrl,
  getFirmaEditorAppUrl,
  getFirmaTemplate,
  isFirmaConfigured,
  listFirmaTemplateFields,
  listFirmaTemplateUsers,
  replaceFirmaTemplateDocument,
  updateFirmaTemplate,
} from "@/lib/firma/client";
import { isFirmaDocumentUrlStale } from "@/lib/firma/document-access";
import { FirmaError } from "@/lib/firma/errors";
import { RECRUITER_TEMPLATE_DOCUMENT_BUCKET } from "@/lib/recruiter-templates/constants";
import { RecruiterTemplateError } from "@/lib/recruiter-templates/errors";
import type {
  ListRecruiterTemplatesFilters,
  RecruiterTemplateDetail,
  RecruiterTemplateFieldRow,
  RecruiterTemplateBuilderSession,
  RecruiterTemplateListItem,
  RecruiterTemplatePreview,
  RecruiterTemplateRoleRow,
  RecruiterTemplateRow,
  SaveRecruiterTemplateInput,
  RecruiterTemplateSyncInput,
} from "@/lib/recruiter-templates/types";
import { canPublish, validatePublishReady } from "@/lib/recruiter-templates/validation";

function mapTemplateRow(row: Record<string, unknown>): RecruiterTemplateRow {
  return row as unknown as RecruiterTemplateRow;
}

function mapRoleRow(row: Record<string, unknown>): RecruiterTemplateRoleRow {
  return row as unknown as RecruiterTemplateRoleRow;
}

function mapFieldRow(row: Record<string, unknown>): RecruiterTemplateFieldRow {
  return row as unknown as RecruiterTemplateFieldRow;
}

async function loadRoles(
  supabase: SupabaseClient,
  templateId: string
): Promise<RecruiterTemplateRoleRow[]> {
  const { data, error } = await supabase
    .from("recruiter_template_roles")
    .select("*")
    .eq("template_id", templateId)
    .order("signing_order", { ascending: true });

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to load template roles", 500, {
      detail: error.message,
    });
  }
  return (data ?? []).map((r) => mapRoleRow(r as Record<string, unknown>));
}

async function loadFields(
  supabase: SupabaseClient,
  templateId: string
): Promise<RecruiterTemplateFieldRow[]> {
  const { data, error } = await supabase
    .from("recruiter_template_fields")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to load template fields", 500, {
      detail: error.message,
    });
  }
  return (data ?? []).map((r) => mapFieldRow(r as Record<string, unknown>));
}

export async function getRecruiterTemplateDetail(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string
): Promise<RecruiterTemplateDetail> {
  const { data, error } = await supabase
    .from("recruiter_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to load template", 500, {
      detail: error.message,
    });
  }
  if (!data) {
    throw new RecruiterTemplateError("NOT_FOUND", "Template not found", 404);
  }

  const row = mapTemplateRow(data as Record<string, unknown>);
  if (row.tenant_id !== tenantId) {
    throw new RecruiterTemplateError("TENANT_MISMATCH", "Template not found", 404);
  }

  const [roles, fields] = await Promise.all([
    loadRoles(supabase, templateId),
    loadFields(supabase, templateId),
  ]);

  return { ...row, roles, fields };
}

export async function listRecruiterTemplates(
  supabase: SupabaseClient,
  tenantId: string,
  filters: ListRecruiterTemplatesFilters = {}
): Promise<RecruiterTemplateListItem[]> {
  let query = supabase
    .from("recruiter_templates")
    .select(
      "id, name, description, category, status, firma_template_id, document_file_name, created_at, updated_at, published_at"
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to list templates", 500, {
      detail: error.message,
    });
  }

  return (data ?? []) as RecruiterTemplateListItem[];
}

async function replaceRolesAndFields(
  supabase: SupabaseClient,
  templateId: string,
  input: SaveRecruiterTemplateInput
): Promise<void> {
  const { error: deleteRolesError } = await supabase
    .from("recruiter_template_roles")
    .delete()
    .eq("template_id", templateId);
  if (deleteRolesError) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to update roles", 500, {
      detail: deleteRolesError.message,
    });
  }

  const { error: deleteFieldsError } = await supabase
    .from("recruiter_template_fields")
    .delete()
    .eq("template_id", templateId);
  if (deleteFieldsError) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to update fields", 500, {
      detail: deleteFieldsError.message,
    });
  }

  if (input.roles.length > 0) {
    const { error: rolesError } = await supabase.from("recruiter_template_roles").insert(
      input.roles.map((role) => ({
        template_id: templateId,
        role_key: role.role_key,
        label: role.label,
        designation: role.designation ?? "Signer",
        signing_order: role.signing_order,
      }))
    );
    if (rolesError) {
      throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to save roles", 500, {
        detail: rolesError.message,
      });
    }
  }

  if (input.fields.length > 0) {
    const { error: fieldsError } = await supabase.from("recruiter_template_fields").insert(
      input.fields.map((field, index) => ({
        template_id: templateId,
        variable_name: field.variable_name,
        label: field.label,
        field_type: field.field_type ?? "text",
        app_data_source: field.app_data_source,
        assigned_role_key: field.assigned_role_key ?? null,
        required: field.required ?? false,
        sort_order: field.sort_order ?? index,
      }))
    );
    if (fieldsError) {
      throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to save fields", 500, {
        detail: fieldsError.message,
      });
    }
  }
}

export async function createRecruiterTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  input: SaveRecruiterTemplateInput,
  userId: string
): Promise<RecruiterTemplateDetail> {
  const { data, error } = await supabase
    .from("recruiter_templates")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      status: "draft",
      expiration_hours: input.expiration_hours ?? 168,
      document_file_name: input.document_file_name ?? null,
      document_storage_path: input.document_storage_path ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to create template", 500, {
      detail: error?.message,
    });
  }

  const templateId = (data as RecruiterTemplateRow).id;
  await replaceRolesAndFields(supabase, templateId, input);
  return getRecruiterTemplateDetail(supabase, tenantId, templateId);
}

export async function updateRecruiterTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  input: SaveRecruiterTemplateInput,
  userId: string
): Promise<RecruiterTemplateDetail> {
  const existing = await getRecruiterTemplateDetail(supabase, tenantId, templateId);
  if (existing.status === "archived") {
    throw new RecruiterTemplateError("VALIDATION_ERROR", "Archived templates cannot be edited", 400);
  }

  const { error } = await supabase
    .from("recruiter_templates")
    .update({
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      expiration_hours: input.expiration_hours ?? existing.expiration_hours,
      document_file_name: input.document_file_name ?? existing.document_file_name,
      document_storage_path: input.document_storage_path ?? existing.document_storage_path,
      updated_by: userId,
    })
    .eq("id", templateId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to update template", 500, {
      detail: error.message,
    });
  }

  await replaceRolesAndFields(supabase, templateId, input);
  return getRecruiterTemplateDetail(supabase, tenantId, templateId);
}

async function readDocumentBase64(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECRUITER_TEMPLATE_DOCUMENT_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new RecruiterTemplateError(
      "VALIDATION_ERROR",
      "Could not read uploaded document for publishing",
      400,
      { detail: error?.message }
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return buffer.toString("base64");
}

function getFirmaSyncedDocumentStoragePath(template: RecruiterTemplateDetail): string | null {
  const value = template.firma_settings?.synced_document_storage_path;
  return typeof value === "string" ? value : null;
}

function buildFirmaSettingsWithSyncedDocument(
  template: RecruiterTemplateDetail,
  documentUrlExpiresAt?: string | null
): Record<string, unknown> {
  return {
    ...template.firma_settings,
    synced_document_storage_path: template.document_storage_path,
    ...(documentUrlExpiresAt !== undefined
      ? { synced_document_url_expires_at: documentUrlExpiresAt }
      : {}),
  };
}

async function ensureFirmaTemplateDocumentUrlFresh(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  userId: string,
  template: RecruiterTemplateDetail,
  firmaTemplateId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<RecruiterTemplateDetail> {
  if (!template.document_storage_path) {
    return template;
  }

  const firmaTemplate = await getFirmaTemplate(firmaTemplateId);
  if (!options.forceRefresh && !isFirmaDocumentUrlStale(firmaTemplate)) {
    return template;
  }

  const document = await readDocumentBase64(supabase, template.document_storage_path);
  const updated = await replaceFirmaTemplateDocument(firmaTemplateId, document);

  const { error } = await supabase
    .from("recruiter_templates")
    .update({
      firma_settings: buildFirmaSettingsWithSyncedDocument(
        template,
        updated.document_url_expires_at ?? null
      ),
      updated_by: userId,
    })
    .eq("id", templateId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to save Firma document state", 500, {
      detail: error.message,
    });
  }

  return getRecruiterTemplateDetail(supabase, tenantId, templateId);
}

async function ensureFirmaTemplateForBuilder(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  userId: string,
  options: { forceRecreate?: boolean; refreshDocument?: boolean } = {}
): Promise<RecruiterTemplateDetail> {
  const template = await getRecruiterTemplateDetail(supabase, tenantId, templateId);

  if (template.status === "archived") {
    throw new RecruiterTemplateError("VALIDATION_ERROR", "Archived templates cannot be edited", 400);
  }

  if (!isFirmaConfigured()) {
    throw new RecruiterTemplateError("NOT_CONFIGURED", "Firma API is not configured", 503);
  }

  async function createAndPersistFirmaTemplate() {
    if (!template.document_storage_path) {
      throw new RecruiterTemplateError(
        "PUBLISH_BLOCKED",
        "Upload a PDF or DOCX before opening the Firma template builder",
        400
      );
    }

    const document = await readDocumentBase64(supabase, template.document_storage_path);
    const created = await createFirmaTemplate({
      name: template.name,
      description: template.description ?? undefined,
      document,
      expiration_hours: template.expiration_hours,
      settings: {
        allow_editing_before_sending: true,
        attach_pdf_on_finish: true,
        allow_download: true,
      },
    });

    if (!created.id) {
      throw new RecruiterTemplateError(
        "FIRMA_ERROR",
        "Firma did not return a template id after document upload",
        502
      );
    }

    const { error } = await supabase
      .from("recruiter_templates")
      .update({
        firma_template_id: created.id,
        firma_settings: buildFirmaSettingsWithSyncedDocument(
          template,
          created.document_url_expires_at ?? null
        ),
        updated_by: userId,
      })
      .eq("id", templateId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to save Firma template", 500, {
        detail: error.message,
      });
    }

    return getRecruiterTemplateDetail(supabase, tenantId, templateId);
  }

  async function recreateFirmaTemplate(existingFirmaTemplateId: string): Promise<RecruiterTemplateDetail> {
    try {
      await deleteFirmaTemplate(existingFirmaTemplateId);
    } catch (err) {
      if (!(err instanceof FirmaError && err.code === "NOT_FOUND")) {
        throw err;
      }
    }
    return createAndPersistFirmaTemplate();
  }

  try {
    if (template.firma_template_id) {
      if (options.forceRecreate) {
        return recreateFirmaTemplate(template.firma_template_id);
      }

      try {
        if (options.refreshDocument) {
          try {
            return await ensureFirmaTemplateDocumentUrlFresh(
              supabase,
              tenantId,
              templateId,
              userId,
              template,
              template.firma_template_id,
              { forceRefresh: true }
            );
          } catch (err) {
            if (err instanceof FirmaError && err.code === "VALIDATION_ERROR") {
              return recreateFirmaTemplate(template.firma_template_id);
            }
            throw err;
          }
        }

        if (
          template.document_storage_path &&
          getFirmaSyncedDocumentStoragePath(template) !== template.document_storage_path
        ) {
          const document = await readDocumentBase64(supabase, template.document_storage_path);
          try {
            const updated = await replaceFirmaTemplateDocument(template.firma_template_id, document);
            await supabase
              .from("recruiter_templates")
              .update({
                firma_settings: buildFirmaSettingsWithSyncedDocument(
                  template,
                  updated.document_url_expires_at ?? null
                ),
                updated_by: userId,
              })
              .eq("id", templateId)
              .eq("tenant_id", tenantId);
            return getRecruiterTemplateDetail(supabase, tenantId, templateId);
          } catch (err) {
            if (err instanceof FirmaError && err.code === "VALIDATION_ERROR") {
              return recreateFirmaTemplate(template.firma_template_id);
            }
            throw err;
          }
        }

        return ensureFirmaTemplateDocumentUrlFresh(
          supabase,
          tenantId,
          templateId,
          userId,
          template,
          template.firma_template_id
        );
      } catch (err) {
        if (err instanceof FirmaError && err.code === "NOT_FOUND") {
          return createAndPersistFirmaTemplate();
        }
        throw err;
      }
    }

    return createAndPersistFirmaTemplate();
  } catch (err) {
    if (err instanceof RecruiterTemplateError) throw err;
    if (err instanceof FirmaError) {
      throw new RecruiterTemplateError("FIRMA_ERROR", err.message, err.status, err.details);
    }
    throw err;
  }
}

export async function createRecruiterTemplateBuilderSession(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  userId: string,
  options: { forceRecreate?: boolean; refreshDocument?: boolean } = {}
): Promise<RecruiterTemplateBuilderSession> {
  const template = await ensureFirmaTemplateForBuilder(
    supabase,
    tenantId,
    templateId,
    userId,
    options
  );
  const firmaTemplateId = template.firma_template_id;
  if (!firmaTemplateId) {
    throw new RecruiterTemplateError("FIRMA_ERROR", "Firma template was not created", 502);
  }

  try {
    const editorAppUrl = getFirmaEditorAppUrl();
    await updateFirmaTemplate(firmaTemplateId, {
      name: template.name,
      description: template.description ?? undefined,
      expiration_hours: template.expiration_hours,
    });
    const jwt = await generateFirmaTemplateJwt(firmaTemplateId);
    const editorUrl = new URL("/template-editor", editorAppUrl);
    editorUrl.searchParams.set("token", jwt.token);

    await supabase
      .from("recruiter_templates")
      .update({
        firma_builder_session_id: jwt.jwt_record_id ?? null,
        updated_by: userId,
      })
      .eq("id", templateId)
      .eq("tenant_id", tenantId);

    return {
      template,
      firma_template_id: firmaTemplateId,
      builder_session_id: jwt.jwt_record_id ?? null,
      jwt: jwt.token,
      editor_url: editorUrl.toString(),
      editor_app_url: editorAppUrl,
      embed_script_url: getFirmaEmbedScriptUrl(),
      expires_at: jwt.expires_at,
    };
  } catch (err) {
    if (err instanceof FirmaError) {
      throw new RecruiterTemplateError("FIRMA_ERROR", err.message, err.status, err.details);
    }
    throw err;
  }
}

export async function syncRecruiterTemplateFromFirma(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  input: RecruiterTemplateSyncInput,
  userId: string
): Promise<RecruiterTemplateDetail> {
  const template = await getRecruiterTemplateDetail(supabase, tenantId, templateId);
  const firmaTemplateId = input.firma_template_id ?? template.firma_template_id;

  if (input.firma_template_id && template.firma_template_id !== input.firma_template_id) {
    throw new RecruiterTemplateError("TENANT_MISMATCH", "Firma template mismatch", 403);
  }

  const status = input.event === "editor.published" || input.draft === false ? "active" : template.status;
  const patch: Record<string, unknown> = {
    status,
    last_synced_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (firmaTemplateId) {
    patch.firma_template_id = firmaTemplateId;
  }
  if (status === "active" && !template.published_at) {
    patch.published_at = input.updated_at ?? new Date().toISOString();
  }

  const { error } = await supabase
    .from("recruiter_templates")
    .update(patch)
    .eq("id", templateId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to sync Firma template", 500, {
      detail: error.message,
    });
  }

  return getRecruiterTemplateDetail(supabase, tenantId, templateId);
}

export async function publishRecruiterTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  userId: string
): Promise<RecruiterTemplateDetail> {
  if (!isFirmaConfigured()) {
    throw new RecruiterTemplateError(
      "NOT_CONFIGURED",
      "Firma API is not configured on the server",
      503
    );
  }

  let template = await getRecruiterTemplateDetail(supabase, tenantId, templateId);
  const publishCheck = validatePublishReady({
    name: template.name,
    category: template.category,
    roles: template.roles,
    fields: template.fields,
    document_storage_path: template.document_storage_path,
    firma_template_id: template.firma_template_id,
  });

  if (!publishCheck.ok) {
    throw new RecruiterTemplateError("PUBLISH_BLOCKED", "Template is not ready to publish", 400, {
      issues: publishCheck.issues,
    });
  }

  try {
    template = await ensureFirmaTemplateForBuilder(supabase, tenantId, templateId, userId);
    const firmaTemplateId = template.firma_template_id;
    if (!firmaTemplateId) {
      throw new RecruiterTemplateError("FIRMA_ERROR", "Firma template was not created", 502);
    }

    const { error: updateError } = await supabase
      .from("recruiter_templates")
      .update({
        firma_template_id: firmaTemplateId,
        status: "active",
        published_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", templateId)
      .eq("tenant_id", tenantId);

    if (updateError) {
      throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to finalize publish", 500, {
        detail: updateError.message,
      });
    }
  } catch (err) {
    if (err instanceof RecruiterTemplateError) throw err;
    if (err instanceof FirmaError) {
      throw new RecruiterTemplateError("FIRMA_ERROR", err.message, err.status, err.details);
    }
    throw err;
  }

  return getRecruiterTemplateDetail(supabase, tenantId, templateId);
}

export async function archiveRecruiterTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  userId: string
): Promise<RecruiterTemplateDetail> {
  await getRecruiterTemplateDetail(supabase, tenantId, templateId);

  const { error } = await supabase
    .from("recruiter_templates")
    .update({ status: "archived", updated_by: userId })
    .eq("id", templateId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to archive template", 500, {
      detail: error.message,
    });
  }

  return getRecruiterTemplateDetail(supabase, tenantId, templateId);
}

export async function duplicateRecruiterTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  userId: string,
  name?: string
): Promise<RecruiterTemplateDetail> {
  const source = await getRecruiterTemplateDetail(supabase, tenantId, templateId);

  return createRecruiterTemplate(
    supabase,
    tenantId,
    {
      name: name?.trim() || `${source.name} (Copy)`,
      description: source.description,
      category: source.category,
      expiration_hours: source.expiration_hours,
      document_file_name: source.document_file_name,
      document_storage_path: source.document_storage_path,
      roles: source.roles.map((r) => ({
        role_key: r.role_key,
        label: r.label,
        designation: r.designation,
        signing_order: r.signing_order,
      })),
      fields: source.fields.map((f) => ({
        variable_name: f.variable_name,
        label: f.label,
        field_type: f.field_type,
        app_data_source: f.app_data_source,
        assigned_role_key: f.assigned_role_key,
        required: f.required,
        sort_order: f.sort_order,
      })),
    },
    userId
  );
}

export async function deleteRecruiterTemplateHard(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string
): Promise<void> {
  const template = await getRecruiterTemplateDetail(supabase, tenantId, templateId);

  if (template.firma_template_id && isFirmaConfigured()) {
    try {
      await deleteFirmaTemplate(template.firma_template_id);
    } catch (err) {
      if (!(err instanceof FirmaError && err.code === "NOT_FOUND")) {
        throw new RecruiterTemplateError(
          "FIRMA_ERROR",
          err instanceof FirmaError ? err.message : "Failed to delete Firma template",
          err instanceof FirmaError ? err.status : 502
        );
      }
    }
  }

  if (template.document_storage_path) {
    await supabase.storage
      .from(RECRUITER_TEMPLATE_DOCUMENT_BUCKET)
      .remove([template.document_storage_path]);
  }

  const { error } = await supabase
    .from("recruiter_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new RecruiterTemplateError("INTERNAL_ERROR", "Failed to delete template", 500, {
      detail: error.message,
    });
  }
}

export async function buildRecruiterTemplatePreview(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  options: { readOnly?: boolean } = {}
): Promise<RecruiterTemplatePreview> {
  const template = await getRecruiterTemplateDetail(supabase, tenantId, templateId);
  const preview: RecruiterTemplatePreview = {
    template,
    editor: {
      embed_script_url: getFirmaEmbedScriptUrl(),
      editor_app_url: getFirmaEditorAppUrl(),
    },
  };

  if (template.firma_template_id && isFirmaConfigured()) {
    try {
      const [firmaTemplate, users, fields] = await Promise.all([
        getFirmaTemplate(template.firma_template_id),
        listFirmaTemplateUsers(template.firma_template_id),
        listFirmaTemplateFields(template.firma_template_id),
      ]);

      preview.firma = {
        document_url: firmaTemplate.document_url,
        document_url_expires_at: firmaTemplate.document_url_expires_at,
        users: users.map((u) => ({
          id: u.id,
          label: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.id,
          designation: u.designation,
          order: u.order,
        })),
        fields: fields.map((f) => ({
          id: f.id,
          variable_name: f.variable_name,
          type: f.type,
          required: f.required,
        })),
      };

      if (!options.readOnly || template.status === "active") {
        const jwt = await generateFirmaTemplateJwt(template.firma_template_id);
        preview.editor = {
          ...preview.editor,
          jwt: jwt.token,
          expires_at: jwt.expires_at,
          embed_script_url: getFirmaEmbedScriptUrl(),
          editor_app_url: getFirmaEditorAppUrl(),
        };
      }
    } catch (err) {
      if (err instanceof FirmaError) {
        throw new RecruiterTemplateError("FIRMA_ERROR", err.message, err.status, err.details);
      }
      throw err;
    }
  }

  return preview;
}

export async function createRecruiterTemplateSigningRequest(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  input: { name?: string; recipients: Array<Record<string, unknown>> }
): Promise<{ signing_request_id: string; firma_template_id: string }> {
  const template = await getRecruiterTemplateDetail(supabase, tenantId, templateId);

  if (template.status !== "active" || !template.firma_template_id) {
    throw new RecruiterTemplateError(
      "PUBLISH_BLOCKED",
      "Publish the template before creating signing requests",
      400
    );
  }

  if (!isFirmaConfigured()) {
    throw new RecruiterTemplateError("NOT_CONFIGURED", "Firma API is not configured", 503);
  }

  try {
    const signingRequest = await createFirmaSigningRequest({
      template_id: template.firma_template_id,
      name: input.name ?? template.name,
      recipients: input.recipients,
    });

    return {
      signing_request_id: signingRequest.id,
      firma_template_id: template.firma_template_id,
    };
  } catch (err) {
    if (err instanceof FirmaError) {
      throw new RecruiterTemplateError("FIRMA_ERROR", err.message, err.status, err.details);
    }
    throw err;
  }
}

export async function createSigningRequestFromDuplicate(
  supabase: SupabaseClient,
  tenantId: string,
  templateId: string,
  name?: string
): Promise<{ signing_request_id: string }> {
  const template = await getRecruiterTemplateDetail(supabase, tenantId, templateId);
  if (!template.firma_template_id) {
    throw new RecruiterTemplateError("PUBLISH_BLOCKED", "Template must be published first", 400);
  }

  try {
    const result = await duplicateFirmaTemplateToSigningRequest(
      template.firma_template_id,
      name ?? template.name
    );
    return { signing_request_id: result.id };
  } catch (err) {
    if (err instanceof FirmaError) {
      throw new RecruiterTemplateError("FIRMA_ERROR", err.message, err.status, err.details);
    }
    throw err;
  }
}

export { canPublish };
