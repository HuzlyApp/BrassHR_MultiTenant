import "server-only";
import { FirmaError } from "@/lib/firma/errors";
import type {
  FirmaApiErrorBody,
  FirmaJwtTokenResponse,
  FirmaSigningRequest,
  FirmaSigningRequestRecipient,
  FirmaTemplate,
  FirmaTemplateField,
  FirmaTemplateSettings,
  FirmaTemplateUser,
  FirmaWorkspaceAppearanceSettings,
} from "@/lib/firma/types";

const DEFAULT_API_BASE = "https://api.firma.dev/functions/v1/signing-request-api";

export function getFirmaApiBaseUrl(): string {
  return (process.env.FIRMA_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, "");
}

export function getFirmaEditorAppUrl(): string {
  return (process.env.FIRMA_EDITOR_APP_URL ?? "https://app.firma.dev").replace(/\/$/, "");
}

export function getFirmaEmbedScriptUrl(): string {
  return (
    process.env.FIRMA_EMBED_SCRIPT_URL ??
    "https://api.firma.dev/functions/v1/embed-proxy/template-editor.js"
  );
}

export function getFirmaWorkspaceId(): string | undefined {
  const id = process.env.FIRMA_WORKSPACE_ID?.trim();
  return id || undefined;
}

export function isFirmaConfigured(): boolean {
  return Boolean(process.env.FIRMA_API_KEY?.trim());
}

function getFirmaApiKey(): string {
  const key = process.env.FIRMA_API_KEY?.trim();
  if (!key) {
    throw new FirmaError("NOT_CONFIGURED", "Firma API is not configured (missing FIRMA_API_KEY)", 503);
  }
  return key;
}

function buildUrl(path: string, workspaceId?: string, includeWorkspaceScope = true): string {
  const base = getFirmaApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);
  if (includeWorkspaceScope) {
    const ws = workspaceId ?? getFirmaWorkspaceId();
    if (ws) url.searchParams.set("workspace_id", ws);
  }
  return url.toString();
}

function isFirmaProxyEnvelope(
  value: unknown
): value is { statusCode: number; body: unknown; headers?: unknown } {
  return (
    value !== null &&
    typeof value === "object" &&
    "statusCode" in value &&
    "body" in value &&
    typeof (value as { statusCode: unknown }).statusCode === "number"
  );
}

function parseFirmaJsonBody(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw.trim()) return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { message: raw };
  }
}

function throwFirmaHttpError(status: number, errBody: FirmaApiErrorBody): never {
  const message = errBody.message ?? errBody.error ?? `Firma API error (${status})`;

  if (status === 401 || status === 403) {
    throw new FirmaError("AUTH_ERROR", message, status, errBody.details);
  }
  if (status === 404) {
    throw new FirmaError("NOT_FOUND", message, status, errBody.details);
  }
  if (status === 400 || status === 422) {
    throw new FirmaError("VALIDATION_ERROR", message, status, errBody.details);
  }
  if (status === 429) {
    throw new FirmaError("RATE_LIMIT", message, status, errBody.details);
  }
  throw new FirmaError("API_ERROR", message, status, errBody.details);
}

async function parseFirmaResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }

  let status = res.status;

  if (isFirmaProxyEnvelope(body)) {
    status = body.statusCode;
    body = parseFirmaJsonBody(body.body);
  }

  if (status < 200 || status >= 300) {
    throwFirmaHttpError(status, (body ?? {}) as FirmaApiErrorBody);
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const errorMessage = typeof record.error === "string" ? record.error.trim() : "";
    if (errorMessage) {
      const errorCode = typeof record.code === "string" ? record.code : undefined;
      const mappedStatus =
        errorCode === "NOT_FOUND" || errorCode === "INVALID_TEMPLATE"
          ? 404
          : errorCode === "AUTH_ERROR"
            ? 401
            : 400;
      throwFirmaHttpError(mappedStatus, body as FirmaApiErrorBody);
    }
  }

  if (body && typeof body === "object" && "data" in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

type FirmaRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  workspaceId?: string;
  retries?: number;
  /** When false, omit workspace_id query param (company/account-level endpoints such as POST /workspaces). */
  includeWorkspaceScope?: boolean;
  /**
   * Override Authorization for workspace-scoped endpoints (e.g. appearance settings).
   * Firma rejects company/other-workspace keys with 403 "Cannot access resources in other workspaces".
   */
  apiKey?: string;
};

async function firmaRequest<T>(path: string, options: FirmaRequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    workspaceId,
    retries = 1,
    includeWorkspaceScope = true,
    apiKey: apiKeyOverride,
  } = options;
  const apiKey = apiKeyOverride?.trim() || getFirmaApiKey();
  const url = buildUrl(path, workspaceId, includeWorkspaceScope);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      return await parseFirmaResponse<T>(res);
    } catch (err) {
      lastError = err;
      if (err instanceof FirmaError) {
        if (err.code === "RATE_LIMIT" && attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : "Network request failed";
  throw new FirmaError("NETWORK_ERROR", msg, 502, lastError);
}

export async function listFirmaTemplates(workspaceId: string): Promise<FirmaTemplate[]> {
  const result = await firmaRequest<FirmaTemplate[] | { templates?: FirmaTemplate[] }>("/templates", {
    workspaceId,
  });
  if (Array.isArray(result)) return result;
  return result.templates ?? [];
}

export async function getFirmaTemplate(id: string, workspaceId: string): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>(`/templates/${id}`, { workspaceId });
}

export async function createFirmaTemplate(
  input: {
    name: string;
    document: string;
    description?: string;
    expiration_hours?: number;
    settings?: FirmaTemplateSettings;
  },
  workspaceId: string
): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>("/templates", {
    method: "POST",
    body: input,
    workspaceId,
    retries: 0,
  });
}

export async function updateFirmaTemplate(
  id: string,
  input: {
    name?: string;
    description?: string;
    document?: string;
    expiration_hours?: number;
    settings?: FirmaTemplateSettings;
    user?: Record<string, unknown>;
    field?: Record<string, unknown>;
  },
  workspaceId: string
): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>(`/templates/${id}`, {
    method: "PATCH",
    body: input,
    workspaceId,
    retries: 0,
  });
}

export async function replaceFirmaTemplateDocument(
  id: string,
  document: string,
  workspaceId: string
): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>(`/templates/${id}/replace-document`, {
    method: "POST",
    body: { document },
    workspaceId,
    retries: 0,
  });
}

export async function deleteFirmaTemplate(id: string, workspaceId: string): Promise<void> {
  await firmaRequest<void>(`/templates/${id}`, { method: "DELETE", workspaceId, retries: 0 });
}

export async function duplicateFirmaTemplateToSigningRequest(
  id: string,
  workspaceId: string,
  name?: string
): Promise<FirmaSigningRequest> {
  return firmaRequest<FirmaSigningRequest>(`/templates/${id}/duplicate`, {
    method: "POST",
    body: name ? { name } : {},
    workspaceId,
    retries: 0,
  });
}

export async function listFirmaTemplateUsers(
  id: string,
  workspaceId: string
): Promise<FirmaTemplateUser[]> {
  const result = await firmaRequest<FirmaTemplateUser[] | { users?: FirmaTemplateUser[] }>(
    `/templates/${id}/users`,
    { workspaceId }
  );
  if (Array.isArray(result)) return result;
  return result.users ?? [];
}

export async function listFirmaTemplateFields(
  id: string,
  workspaceId: string
): Promise<FirmaTemplateField[]> {
  const result = await firmaRequest<FirmaTemplateField[] | { fields?: FirmaTemplateField[] }>(
    `/templates/${id}/fields`,
    { workspaceId }
  );
  if (Array.isArray(result)) return result;
  return result.fields ?? [];
}

export function normalizeFirmaTemplateJwt(value: unknown): string {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) {
    throw new FirmaError("API_ERROR", "Firma JWT response did not include a token", 502);
  }

  const normalized = token.startsWith("Bearer ") ? token.slice(7).trim() : token;
  if (normalized.split(".").length !== 3) {
    throw new FirmaError("API_ERROR", "Firma JWT response had an invalid token format", 502);
  }

  return normalized;
}

export async function generateFirmaTemplateJwt(
  templateId: string,
  workspaceId: string
): Promise<FirmaJwtTokenResponse> {
  const response = await firmaRequest<FirmaJwtTokenResponse>("/generate-template-token", {
    method: "POST",
    body: { companies_workspaces_templates_id: templateId },
    workspaceId,
    retries: 1,
  });

  return {
    ...response,
    token: normalizeFirmaTemplateJwt(response.token),
  };
}

export type CreateFirmaSigningRequestInput = {
  template_id: string;
  name?: string;
  description?: string;
  recipients?: Array<Record<string, unknown>>;
};

export async function createFirmaSigningRequest(
  input: CreateFirmaSigningRequestInput,
  workspaceId: string
): Promise<FirmaSigningRequest> {
  return firmaRequest<FirmaSigningRequest>("/signing-requests", {
    method: "POST",
    body: input,
    workspaceId,
    retries: 0,
  });
}

/** Creates a signing request and sends it in one call (required for embedded signing URLs). */
export async function createAndSendFirmaSigningRequest(
  input: CreateFirmaSigningRequestInput,
  workspaceId: string
): Promise<FirmaSigningRequest> {
  try {
    return await firmaRequest<FirmaSigningRequest>("/signing-requests/create-and-send", {
      method: "POST",
      body: input,
      workspaceId,
      retries: 0,
    });
  } catch (err) {
    if (err instanceof FirmaError && err.code === "NOT_FOUND") {
      const draft = await createFirmaSigningRequest(input, workspaceId);
      return sendFirmaSigningRequest(draft.id, workspaceId);
    }
    throw err;
  }
}

export async function sendFirmaSigningRequest(
  signingRequestId: string,
  workspaceId: string
): Promise<FirmaSigningRequest> {
  return firmaRequest<FirmaSigningRequest>(`/signing-requests/${signingRequestId}/send`, {
    method: "POST",
    body: {},
    workspaceId,
    retries: 0,
  });
}

export async function getFirmaSigningRequest(
  id: string,
  workspaceId: string
): Promise<FirmaSigningRequest> {
  return firmaRequest<FirmaSigningRequest>(`/signing-requests/${id}`, { workspaceId, retries: 1 });
}

type FirmaSigningRequestUsersResponse =
  | FirmaSigningRequestRecipient[]
  | { items?: FirmaSigningRequestRecipient[] };

function normalizeFirmaSigningRequestUsers(
  response: FirmaSigningRequestUsersResponse
): FirmaSigningRequestRecipient[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  return [];
}

export async function getFirmaSigningRequestUsers(
  signingRequestId: string,
  workspaceId: string
): Promise<FirmaSigningRequestRecipient[]> {
  const response = await firmaRequest<FirmaSigningRequestUsersResponse>(
    `/signing-requests/${signingRequestId}/users`,
    { workspaceId, retries: 1 }
  );
  return normalizeFirmaSigningRequestUsers(response);
}

export type FirmaWorkspace = {
  id: string;
  name?: string;
};

/** Workspace detail including scoped keys — never persist api_key / test_api_key. */
export type FirmaWorkspaceDetail = FirmaWorkspace & {
  api_key?: string | null;
  test_api_key?: string | null;
  protected?: boolean | null;
};

type FirmaWorkspaceListResponse = {
  results?: FirmaWorkspaceDetail[];
  pagination?: {
    current_page?: number;
    page_size?: number;
    total_count?: number;
    total_pages?: number;
  };
};

/**
 * Resolve the live api_key for a workspace.
 * Firma returns scoped keys on GET /workspaces (list). GET /workspaces/{id} often
 * returns 403 for non-own keys, so branding sync must use the list endpoint.
 */
export async function resolveFirmaWorkspaceApiKey(workspaceId: string): Promise<string> {
  const target = workspaceId.trim();
  if (!target) {
    throw new FirmaError("VALIDATION_ERROR", "Firma workspace id is required", 400);
  }

  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const path =
      page === 1 ? "/workspaces" : `/workspaces?page=${page}`;
    const result = await firmaRequest<FirmaWorkspaceListResponse | FirmaWorkspaceDetail[]>(path, {
      includeWorkspaceScope: false,
      retries: 1,
    });

    const rows = Array.isArray(result) ? result : result.results ?? [];
    const match = rows.find((row) => row.id?.trim() === target);
    const apiKey = match?.api_key?.trim();
    if (apiKey) return apiKey;

    if (!Array.isArray(result) && result.pagination) {
      totalPages = Math.max(1, Number(result.pagination.total_pages) || 1);
    } else {
      break;
    }
    page += 1;
  }

  throw new FirmaError(
    "AUTH_ERROR",
    `Firma workspace api_key was not found for workspace ${target}; cannot update appearance settings`,
    403
  );
}

/** Official endpoint: POST /workspaces (docs.firma.dev/guides/creating-workspaces) */
export async function createFirmaWorkspace(input: {
  name: string;
  slug?: string | null;
}): Promise<FirmaWorkspace> {
  const name = input.name.trim();
  if (!name) {
    throw new FirmaError("VALIDATION_ERROR", "Firma workspace name is required", 400);
  }

  const result = await firmaRequest<FirmaWorkspace>("/workspaces", {
    method: "POST",
    body: { name },
    includeWorkspaceScope: false,
    retries: 0,
  });

  const id = typeof result?.id === "string" ? result.id.trim() : "";
  if (!id) {
    throw new FirmaError("API_ERROR", "Firma did not return a workspace id", 502);
  }

  return { id, name: result.name ?? name };
}

/**
 * Sync workspace appearance (embedded editor + signing chrome).
 * Must authenticate with the target workspace's own api_key — company/other-workspace
 * keys return 403 for appearance settings even when template/signing ops work via workspace_id.
 */
export async function updateFirmaWorkspaceSettings(
  workspaceId: string,
  settings: FirmaWorkspaceAppearanceSettings
): Promise<FirmaWorkspaceAppearanceSettings> {
  const id = workspaceId.trim();
  if (!id) {
    throw new FirmaError("VALIDATION_ERROR", "Firma workspace id is required", 400);
  }

  const workspaceApiKey = await resolveFirmaWorkspaceApiKey(id);

  return firmaRequest<FirmaWorkspaceAppearanceSettings>(`/workspace/${id}/settings`, {
    method: "PUT",
    body: settings,
    includeWorkspaceScope: false,
    apiKey: workspaceApiKey,
    retries: 1,
  });
}

export function resolveFirmaRecipientSigningUrl(
  recipient: FirmaSigningRequestRecipient | null | undefined
): string | null {
  if (!recipient) return null;
  const direct = recipient.signing_url?.trim() || recipient.signing_link?.trim();
  if (direct) return direct;
  const recipientId = recipient.id?.trim();
  if (!recipientId) return null;
  return `${getFirmaEditorAppUrl()}/signing/${recipientId}`;
}

export function resolveApplicantSigningRecipient(
  detail: FirmaSigningRequest,
  email: string,
  users?: FirmaSigningRequestRecipient[]
): FirmaSigningRequestRecipient | null {
  const normalized = email.trim().toLowerCase();
  const recipients =
    Array.isArray(detail.recipients) && detail.recipients.length > 0
      ? detail.recipients
      : Array.isArray(users) && users.length > 0
        ? users
        : [];
  const match = recipients.find(
    (recipient) => (recipient.email ?? "").trim().toLowerCase() === normalized
  );
  if (match) return match;
  if (detail.first_signer?.id) return detail.first_signer;
  return recipients[0] ?? null;
}

export function resolveFirmaSigningIframeUrl(
  recipient: FirmaSigningRequestRecipient | null | undefined,
  fallbackUserId?: string | null
): string | null {
  return (
    resolveFirmaRecipientSigningUrl(recipient) ??
    resolveFirmaRecipientSigningUrl(fallbackUserId?.trim() ? { id: fallbackUserId.trim() } : null)
  );
}
