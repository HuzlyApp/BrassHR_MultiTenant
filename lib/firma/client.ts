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

function buildUrl(path: string, workspaceId?: string): string {
  const base = getFirmaApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);
  const ws = workspaceId ?? getFirmaWorkspaceId();
  if (ws) url.searchParams.set("workspace_id", ws);
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
};

async function firmaRequest<T>(path: string, options: FirmaRequestOptions = {}): Promise<T> {
  const { method = "GET", body, workspaceId, retries = 1 } = options;
  const apiKey = getFirmaApiKey();
  const url = buildUrl(path, workspaceId);

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

export async function listFirmaTemplates(): Promise<FirmaTemplate[]> {
  const result = await firmaRequest<FirmaTemplate[] | { templates?: FirmaTemplate[] }>("/templates");
  if (Array.isArray(result)) return result;
  return result.templates ?? [];
}

export async function getFirmaTemplate(id: string): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>(`/templates/${id}`);
}

export async function createFirmaTemplate(input: {
  name: string;
  document: string;
  description?: string;
  expiration_hours?: number;
  settings?: FirmaTemplateSettings;
}): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>("/templates", {
    method: "POST",
    body: input,
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
  }
): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>(`/templates/${id}`, {
    method: "PATCH",
    body: input,
    retries: 0,
  });
}

export async function replaceFirmaTemplateDocument(
  id: string,
  document: string
): Promise<FirmaTemplate> {
  return firmaRequest<FirmaTemplate>(`/templates/${id}/replace-document`, {
    method: "POST",
    body: { document },
    retries: 0,
  });
}

export async function deleteFirmaTemplate(id: string): Promise<void> {
  await firmaRequest<void>(`/templates/${id}`, { method: "DELETE", retries: 0 });
}

export async function duplicateFirmaTemplateToSigningRequest(
  id: string,
  name?: string
): Promise<FirmaSigningRequest> {
  return firmaRequest<FirmaSigningRequest>(`/templates/${id}/duplicate`, {
    method: "POST",
    body: name ? { name } : {},
    retries: 0,
  });
}

export async function listFirmaTemplateUsers(id: string): Promise<FirmaTemplateUser[]> {
  const result = await firmaRequest<FirmaTemplateUser[] | { users?: FirmaTemplateUser[] }>(
    `/templates/${id}/users`
  );
  if (Array.isArray(result)) return result;
  return result.users ?? [];
}

export async function listFirmaTemplateFields(id: string): Promise<FirmaTemplateField[]> {
  const result = await firmaRequest<FirmaTemplateField[] | { fields?: FirmaTemplateField[] }>(
    `/templates/${id}/fields`
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

export async function generateFirmaTemplateJwt(templateId: string): Promise<FirmaJwtTokenResponse> {
  const response = await firmaRequest<FirmaJwtTokenResponse>("/generate-template-token", {
    method: "POST",
    body: { companies_workspaces_templates_id: templateId },
    retries: 1,
  });

  return {
    ...response,
    token: normalizeFirmaTemplateJwt(response.token),
  };
}

export async function createFirmaSigningRequest(input: {
  template_id: string;
  name?: string;
  description?: string;
  recipients?: Array<Record<string, unknown>>;
}): Promise<FirmaSigningRequest> {
  return firmaRequest<FirmaSigningRequest>("/signing-requests", {
    method: "POST",
    body: input,
    retries: 0,
  });
}

export async function getFirmaSigningRequest(id: string): Promise<FirmaSigningRequest> {
  return firmaRequest<FirmaSigningRequest>(`/signing-requests/${id}`, { retries: 1 });
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
  signingRequestId: string
): Promise<FirmaSigningRequestRecipient[]> {
  const response = await firmaRequest<FirmaSigningRequestUsersResponse>(
    `/signing-requests/${signingRequestId}/users`,
    { retries: 1 }
  );
  return normalizeFirmaSigningRequestUsers(response);
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
