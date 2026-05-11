// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeZohoEmbedHostCandidate } from "../_shared/embed-host.ts";
declare const Deno: { env: { get: (name: string) => string | undefined } };

type SendAgreementInput = {
  name?: string;
  email?: string;
  user_id?: string | null;
  project_id?: string | null;
  host?: string | null;
};

type ZohoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type ZohoTemplateDetailsResponse = {
  status?: string;
  message?: string;
  templates?: {
    template_name?: string;
    actions?: Array<{
      action_id?: string;
      action_type?: string;
      role?: string;
    }>;
  };
};

type ZohoCreateFromTemplateResponse = {
  status?: string;
  code?: unknown;
  message?: string;
  requests?: {
    request_id?: string;
    document_ids?: Array<{ document_id?: string }>;
    document_id?: string;
    actions?: Array<{
      action_id?: string;
      action_type?: string;
      recipient_email?: string;
      action_url?: string;
      sign_url?: string;
    }>;
  };
};

type ErrorStage =
  | "cors"
  | "request_validation"
  | "env_validation"
  | "duplicate_email"
  | "zoho_token"
  | "zoho_send"
  | "zoho_parse"
  | "db_insert"
  | "unknown";

type ErrorResponse = {
  success: false;
  stage: ErrorStage;
  message: string;
  details?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const REQUIRED_ENVS = [
  "ZOHO_SIGN_TEMPLATE_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function fail(stage: ErrorStage, message: string, status: number, details?: unknown): Response {
  const payload: ErrorResponse = { success: false, stage, message };
  if (details !== undefined) payload.details = details;
  console.error("[send-agreement] returning error", { stage, status, message, details });
  return jsonResponse(payload, status);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolve the HTTPS origin used for the Zoho embedtoken `host` param.
 * Priority: normalized client-supplied URL → ZOHO_SIGN_EMBED_HOST secret → empty (skip embedtoken).
 * Accepts bare hostnames (e.g. hr.example.com → https://hr.example.com). HTTP localhost → skip.
 */
function getEffectiveEmbedHost(requestedHost: string): string {
  const fromClient = normalizeZohoEmbedHostCandidate(requestedHost || "");
  if (fromClient) return fromClient;
  return normalizeZohoEmbedHostCandidate(Deno.env.get("ZOHO_SIGN_EMBED_HOST") || "");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getEnv(name: (typeof REQUIRED_ENVS)[number]): string {
  return Deno.env.get(name)?.trim() || "";
}

function getZohoClientId(): string {
  return Deno.env.get("ZOHO_SIGN_CLIENT_ID")?.trim() || "";
}

function getZohoClientSecret(): string {
  return Deno.env.get("ZOHO_SIGN_CLIENT_SECRET")?.trim() || "";
}

function getZohoRefreshToken(): string {
  return Deno.env.get("ZOHO_SIGN_REFRESH_TOKEN")?.trim() || "";
}

function getZohoAccountsHost(): string {
  return (
    Deno.env.get("ZOHO_ACCOUNTS_HOST")?.trim() ||
    Deno.env.get("ZOHO_ACCOUNTS_BASE_URL")?.trim() ||
    "https://accounts.zoho.com"
  );
}

function isInvalidZohoSignApiBase(base: string): boolean {
  const b = base.replace(/\/$/, "").toLowerCase();
  return /^https?:\/\/(www\.)?zoho\.com$/i.test(b);
}

/** Same mapping as `lib/zoho-sign-server.ts` — one Sign host per OAuth token (Zoho DC). */
function signApiBaseFromAccountsUrl(accountsUrl: string): string | null {
  let host: string;
  try {
    host = new URL(accountsUrl.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  const map: Record<string, string> = {
    "accounts.zoho.com": "https://sign.zoho.com",
    "accounts.zoho.eu": "https://sign.zoho.eu",
    "accounts.zoho.in": "https://sign.zoho.in",
    "accounts.zoho.com.au": "https://sign.zoho.com.au",
    "accounts.zoho.jp": "https://sign.zoho.jp",
    "accounts.zohocloud.ca": "https://sign.zohocloud.ca",
    "accounts.zoho.sa": "https://sign.zoho.sa",
  };
  return map[host] || null;
}

/** Single Sign REST origin for this token — do not probe every regional host (9041 on wrong DC). */
function getZohoSignApiBase(): string {
  const configured = [
    Deno.env.get("ZOHO_SIGN_API_BASE")?.trim() || "",
    Deno.env.get("ZOHO_SIGN_BASE_URL")?.trim() || "",
  ]
    .filter(Boolean)
    .map((value) => value.replace(/\/$/, ""))
    .find((b) => !isInvalidZohoSignApiBase(b));
  if (configured) return configured;
  const derived = signApiBaseFromAccountsUrl(getZohoAccountsHost());
  if (derived) return derived;
  return "https://sign.zoho.com";
}

function getZohoApiBaseCandidates(): string[] {
  return [getZohoSignApiBase()];
}

function logEnvAvailability() {
  const availability = {
    ZOHO_SIGN_TEMPLATE_ID: Boolean(getEnv("ZOHO_SIGN_TEMPLATE_ID")),
    SUPABASE_URL: Boolean(getEnv("SUPABASE_URL")),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(getEnv("SUPABASE_SERVICE_ROLE_KEY")),
    ZOHO_SIGN_CLIENT_ID: Boolean(getZohoClientId()),
    ZOHO_SIGN_CLIENT_SECRET: Boolean(getZohoClientSecret()),
    ZOHO_SIGN_REFRESH_TOKEN: Boolean(getZohoRefreshToken()),
    ZOHO_ACCOUNTS_HOST_OR_ZOHO_ACCOUNTS_BASE_URL: Boolean(getZohoAccountsHost()),
    ZOHO_SIGN_API_BASE_OR_ZOHO_SIGN_BASE_URL: Boolean(getZohoApiBaseCandidates()[0]),
  };
  console.log("[send-agreement] env availability", availability);
}

async function fetchZohoAccessToken(): Promise<{
  ok: boolean;
  accessToken?: string;
  status: number;
  body: string;
}> {
  const tokenUrl = `${getZohoAccountsHost().replace(/\/$/, "")}/oauth/v2/token`;
  const body = new URLSearchParams({
    refresh_token: getZohoRefreshToken(),
    client_id: getZohoClientId(),
    client_secret: getZohoClientSecret(),
    grant_type: "refresh_token",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const rawBody = await response.text();

  let parsed: ZohoTokenResponse = {};
  try {
    parsed = JSON.parse(rawBody) as ZohoTokenResponse;
  } catch {
    // parse handled by caller stage.
  }

  console.log("[send-agreement] zoho token response status", response.status);

  if (!response.ok || !parsed.access_token) {
    return { ok: false, status: response.status, body: rawBody };
  }
  return { ok: true, status: response.status, body: rawBody, accessToken: parsed.access_token };
}

async function zohoRequest(base: string, path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  return await fetch(`${base}${path}`, {
    method: init?.method || "GET",
    headers: {
      ...(init?.headers || {}),
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: init?.body,
  });
}

type ZohoGetRequestDetailResponse = {
  status?: string;
  message?: string;
  requests?: {
    actions?: Array<{ action_id?: string; action_type?: string }>;
  };
};

/** Template quicksend often omits actions[].action_id; GET fills it for embedtoken. */
async function fetchSignerActionIdFromRequest(
  base: string,
  requestId: string,
  accessToken: string,
): Promise<string> {
  try {
    const getRes = await zohoRequest(base, `/api/v1/requests/${encodeURIComponent(requestId)}`, accessToken);
    const text = await getRes.text();
    let getJson: ZohoGetRequestDetailResponse = {};
    try {
      getJson = JSON.parse(text) as ZohoGetRequestDetailResponse;
    } catch {
      return "";
    }
    if (!getRes.ok || getJson.status !== "success") {
      console.warn("[send-agreement] GET /requests/{id} for action_id failed", getRes.status, text.slice(0, 280));
      return "";
    }
    const reqActions = getJson.requests?.actions || [];
    const signer =
      reqActions.find((a) => (a.action_type || "").trim().toUpperCase() === "SIGN") || reqActions[0];
    const id = (typeof signer?.action_id === "string" && signer.action_id.trim()) || "";
    if (id) console.log("[send-agreement] resolved signer action_id via GET /requests/:id");
    return id;
  } catch (e) {
    console.warn("[send-agreement] fetchSignerActionIdFromRequest exception", e);
    return "";
  }
}

serve(async (req) => {
  console.log("[send-agreement] request method", req.method);

  if (req.method === "OPTIONS") {
    console.log("[send-agreement] final stage before return", "cors_preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("cors", "Method not allowed. Use POST.", 405);
  }

  logEnvAvailability();
  const missingEnvVars: string[] = REQUIRED_ENVS.filter((name) => !getEnv(name));
  if (!getZohoClientId()) missingEnvVars.push("ZOHO_SIGN_CLIENT_ID");
  if (!getZohoClientSecret()) missingEnvVars.push("ZOHO_SIGN_CLIENT_SECRET");
  if (!getZohoRefreshToken()) missingEnvVars.push("ZOHO_SIGN_REFRESH_TOKEN");
  if (missingEnvVars.length > 0) {
    return fail("env_validation", "Missing required environment variables", 500, {
      missing: missingEnvVars,
    });
  }

  let body: SendAgreementInput;
  try {
    const raw = await req.text();
    body = JSON.parse(raw || "{}") as SendAgreementInput;
  } catch (error) {
    console.error("[send-agreement] request parse error", error);
    return fail("request_validation", "Invalid JSON body", 400);
  }

  console.log("[send-agreement] parsed request body", {
    has_name: Boolean(body?.name?.trim()),
    email: body?.email ? normalizeEmail(body.email) : "",
    has_user_id: Boolean(body?.user_id),
    has_project_id: Boolean(body?.project_id),
  });

  const name = (body.name || "").trim();
  const email = normalizeEmail(body.email || "");
  const userId = body.user_id?.trim() || null;
  const projectId = body.project_id?.trim() || null;
  const host = (body.host || "").trim().replace(/\/$/, "");

  if (!name || !email) {
    return fail("request_validation", "name and email are required", 400);
  }
  if (!isValidEmail(email)) {
    return fail("request_validation", "email format is invalid", 400);
  }

  const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

  if (!userId) {
    return fail("request_validation", "user_id (onboarding applicant UUID) is required", 400);
  }

  const { data: workerForTenant, error: workerTenantErr } = await supabase
    .from("worker")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (workerTenantErr) {
    console.error("[send-agreement] worker tenant lookup", workerTenantErr);
    return fail("request_validation", "Could not resolve tenant for applicant", 500, {
      message: workerTenantErr.message,
    });
  }
  if (workerForTenant?.tenant_id == null) {
    return fail(
      "request_validation",
      "Worker profile is missing tenant_id. Save Step 1 (profile) before requesting the agreement.",
      400,
    );
  }
  const tenantId = String(workerForTenant.tenant_id);

  const { data: existingRows, error: dupLookupError } = await supabase
    .from("zoho_sign_requests")
    .select("request_id,status,recipient_name,created_at")
    .eq("tenant_id", tenantId)
    .eq("source", "onboarding")
    .eq("email", email)
    .neq("status", "declined");

  if (dupLookupError) {
    console.error("[send-agreement] duplicate email lookup failed", dupLookupError);
    return fail("request_validation", "Could not verify whether this email is eligible for a new agreement", 500, {
      message: dupLookupError.message,
    });
  }

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    const existingRequestId = (existing?.request_id as string | undefined)?.trim() || "";
    let embeddedSigningUrl: string | null = null;

    const effectiveHostExisting = getEffectiveEmbedHost(host);
    console.log("[send-agreement] existing request re-embed host", { raw: host, effective: effectiveHostExisting });

    if (existingRequestId && effectiveHostExisting) {
      try {
        const tokenResult = await fetchZohoAccessToken();
        if (tokenResult.ok && tokenResult.accessToken) {
          const token = tokenResult.accessToken;
          for (const candidateBase of getZohoApiBaseCandidates()) {
            try {
              const getRes = await zohoRequest(candidateBase, `/api/v1/requests/${encodeURIComponent(existingRequestId)}`, token);
              const getJson = JSON.parse(await getRes.text()) as {
                status?: string;
                requests?: { actions?: Array<{ action_id?: string; action_type?: string }> };
              };
              if (!getRes.ok || getJson.status !== "success") continue;
              const reqActions = getJson.requests?.actions || [];
              const actionId =
                (reqActions.find((a) => (a.action_type || "").toUpperCase() === "SIGN") || reqActions[0])?.action_id?.trim() || "";
              if (!actionId) continue;
              const embedRes = await zohoRequest(
                candidateBase,
                `/api/v1/requests/${encodeURIComponent(existingRequestId)}/actions/${encodeURIComponent(actionId)}/embedtoken`,
                token,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: new URLSearchParams({ host: effectiveHostExisting }).toString(),
                },
              );
              const embedText = await embedRes.text();
              const embedJson = JSON.parse(embedText) as { status?: string; sign_url?: string };
              console.log("[send-agreement] existing request embedtoken", { status: embedRes.status, body: embedText.slice(0, 300) });
              if (embedJson.status === "success" && embedJson.sign_url?.trim()) {
                embeddedSigningUrl = embedJson.sign_url.trim();
                await supabase
                  .from("zoho_sign_requests")
                  .update({ signing_url: embeddedSigningUrl, updated_at: new Date().toISOString() })
                  .eq("request_id", existingRequestId);
                break;
              }
            } catch { continue; }
          }
        }
      } catch (e) {
        console.warn("[send-agreement] re-embed for existing request failed", e);
      }
    }

    console.log("[send-agreement] returning existing request, signing_url:", embeddedSigningUrl ? "set" : "null");

    const existingSigningError = embeddedSigningUrl
      ? null
      : !effectiveHostExisting
        ? "No HTTPS embed host. Set NEXT_PUBLIC_APP_URL=https://your-domain.com (restart dev server) or set Supabase Edge secret ZOHO_SIGN_EMBED_HOST."
        : "Could not refresh an embedded signing URL from Zoho. Check Zoho Sign allowed domains or try again.";

    return jsonResponse({
      success: true,
      request_id: existingRequestId,
      status: (existing?.status as string) || "sent",
      email,
      name,
      signing_url: embeddedSigningUrl,
      signing_url_error: existingSigningError,
    });
  }

  const templateName = "Onboarding Agreement";
  const templateId = getEnv("ZOHO_SIGN_TEMPLATE_ID");
  const zohoApiBases = getZohoApiBaseCandidates();
  // Log template usage
  console.log("[send-agreement] using template-based signing", {
    templateId: templateId ? `${templateId.slice(0, 8)}***` : "missing",
    templateName,
    zohoApiBases: zohoApiBases.map(u => new URL(u).hostname),
  });
  let accessToken = "";
  try {
    const tokenResult = await fetchZohoAccessToken();
    if (!tokenResult.ok || !tokenResult.accessToken) {
      console.error("[send-agreement] zoho token failure body", tokenResult.body);
      return fail("zoho_token", "Failed to fetch Zoho access token", 502, {
        status: tokenResult.status,
      });
    }
    accessToken = tokenResult.accessToken;
  } catch (error) {
    console.error("[send-agreement] zoho token exception", error);
    return fail("zoho_token", "Failed to fetch Zoho access token", 502);
  }

  let signerActionId = "";
  let activeZohoBase = zohoApiBases[0];
  try {
    let templateFound = false;
    let lastZohoFailure: { base: string; status: number; message?: string; code?: unknown } | null = null;
    let sawJsonFailure = false;
    const templateAttemptDebug: Array<{
      base: string;
      status: number;
      content_type: string | null;
      body_preview: string;
      parseable_json: boolean;
    }> = [];
    for (const candidateBase of zohoApiBases) {
      const templateRes = await zohoRequest(
        candidateBase,
        `/api/v1/templates/${encodeURIComponent(templateId)}`,
        accessToken,
      );
      const templateBody = await templateRes.text();
      const contentType = templateRes.headers.get("content-type");
      console.log("[send-agreement] zoho template response status", templateRes.status);
      console.log("[send-agreement] zoho template response body", templateBody);

      let templateJson: ZohoTemplateDetailsResponse = {};
      let parseableJson = true;
      try {
        templateJson = JSON.parse(templateBody) as ZohoTemplateDetailsResponse;
      } catch {
        parseableJson = false;
        templateAttemptDebug.push({
          base: candidateBase,
          status: templateRes.status,
          content_type: contentType,
          body_preview: templateBody.slice(0, 180),
          parseable_json: false,
        });
        continue;
      }
      templateAttemptDebug.push({
        base: candidateBase,
        status: templateRes.status,
        content_type: contentType,
        body_preview: templateBody.slice(0, 180),
        parseable_json: parseableJson,
      });

      if (!templateRes.ok || templateJson.status !== "success") {
        sawJsonFailure = true;
        const templateJsonWithCode = templateJson as ZohoTemplateDetailsResponse & { code?: unknown };
        lastZohoFailure = {
          base: candidateBase,
          status: templateRes.status,
          message: templateJson.message || "Unknown Zoho error",
          code: templateJsonWithCode.code,
        };
        continue;
      }

      const actions = templateJson.templates?.actions || [];
      signerActionId =
        actions.find(
          (action) =>
            (action.role || "").trim().toLowerCase() === "signer" &&
            (action.action_type || "").trim().toUpperCase() === "SIGN",
        )?.action_id?.trim() ||
        "";

      if (!signerActionId) {
        return fail(
          "zoho_send",
          'Template is missing SIGN action for role "Signer"',
          400,
        );
      }

      activeZohoBase = candidateBase;
      templateFound = true;
      break;
    }

    if (!templateFound) {
      if (sawJsonFailure && lastZohoFailure) {
        const scopeError =
          Number(lastZohoFailure.code) === 9040 ||
          /invalid oauth scope/i.test(String(lastZohoFailure.message || ""));
        return fail("zoho_send", "Zoho template lookup failed", 502, {
          ...lastZohoFailure,
          remediation: scopeError
            ? "ZOHO_SIGN_REFRESH_TOKEN does not include required Zoho Sign scopes. Generate a new Zoho Sign refresh token for this app (with template/document scopes) and update ZOHO_SIGN_CLIENT_ID, ZOHO_SIGN_CLIENT_SECRET, and ZOHO_SIGN_REFRESH_TOKEN."
            : undefined,
          attempts: templateAttemptDebug,
        });
      }
      return fail("zoho_parse", "Failed to parse Zoho template response", 502, {
        tried_bases: zohoApiBases,
        attempts: templateAttemptDebug,
      });
    }
  } catch (error) {
    console.error("[send-agreement] zoho template exception", error);
    return fail("zoho_send", "Failed while validating Zoho template", 502);
  }

  const zohoPayload = {
    templates: {
      request_name: `${templateName} - ${name}`,
      notes: "",
      field_data: {
        field_text_data: {},
        field_boolean_data: {},
        field_date_data: {},
      },
      actions: [
        {
          action_id: signerActionId,
          role: "Signer",
          action_type: "SIGN",
          recipient_name: name,
          recipient_email: email,
          verify_recipient: false,
          is_embedded: true,
        },
      ],
    },
  };

  console.log("[send-agreement] zoho template payload", {
    templateId: templateId ? `${templateId.slice(0, 8)}***` : "missing",
    requestName: zohoPayload.templates.request_name,
    signerActionId: signerActionId ? `${signerActionId.slice(0, 8)}***` : "missing",
    recipientEmail: email,
    isEmbedded: zohoPayload.templates.actions[0].is_embedded,
    apiEndpoint: `/api/v1/templates/{templateId}/createdocument?is_quicksend=true`,
  });

  let zohoJson: ZohoCreateFromTemplateResponse = {};
  try {
    const createBody = new URLSearchParams({ data: JSON.stringify(zohoPayload) });
    const zohoRes = await zohoRequest(
      activeZohoBase,
      `/api/v1/templates/${encodeURIComponent(templateId)}/createdocument?is_quicksend=true`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createBody.toString(),
      },
    );
    const zohoText = await zohoRes.text();

    console.log("[send-agreement] zoho send response status", zohoRes.status);
    console.log("[send-agreement] zoho send response body", zohoText);

    try {
      zohoJson = JSON.parse(zohoText) as ZohoCreateFromTemplateResponse;
    } catch {
      return fail("zoho_parse", "Failed to parse Zoho send response", 502);
    }

    if (!zohoRes.ok || zohoJson.status !== "success") {
      return fail("zoho_send", "Zoho template send failed", 502, {
        status: zohoRes.status,
        zoho_status: zohoJson.status,
        zoho_code: zohoJson.code,
        zoho_message: zohoJson.message,
      });
    }
  } catch (error) {
    console.error("[send-agreement] zoho send exception", error);
    return fail("zoho_send", "Failed to send agreement to Zoho", 502);
  }

  const requestId = zohoJson.requests?.request_id?.trim();
  if (!requestId) {
    return fail("zoho_parse", "Zoho response missing request_id", 502);
  }

  const reqBlock = zohoJson.requests || {};
  const docIds = Array.isArray(reqBlock.document_ids) ? reqBlock.document_ids : [];
  const zohoDocumentId =
    (typeof reqBlock.document_id === "string" && reqBlock.document_id.trim()) ||
    (typeof docIds[0]?.document_id === "string" && docIds[0].document_id.trim()) ||
    null;
  const actions = Array.isArray(reqBlock.actions) ? reqBlock.actions : [];
  const signerAction =
    actions.find((a) => (a.action_type || "").toUpperCase() === "SIGN") || actions[0] || {};
  let signerActionIdFromResponse =
    (typeof signerAction.action_id === "string" && signerAction.action_id.trim()) || "";

  if (!signerActionIdFromResponse && requestId) {
    signerActionIdFromResponse = await fetchSignerActionIdFromRequest(
      activeZohoBase,
      requestId,
      accessToken,
    );
  }
  if (!signerActionIdFromResponse && signerActionId) {
    signerActionIdFromResponse = signerActionId;
    console.log("[send-agreement] using template action_id fallback for embedtoken");
  }

  // Attempt embedded signing URL via embedtoken
  let signingUrl: string | null =
    (typeof signerAction.sign_url === "string" && signerAction.sign_url.trim()) ||
    (typeof signerAction.action_url === "string" && signerAction.action_url.trim()) ||
    null;

  const effectiveHost = getEffectiveEmbedHost(host);
  let embedHttpStatus: number | undefined;
  let embedZohoMsg: string | undefined;
  console.log("[send-agreement] new request embed host", {
    raw: host,
    effective: effectiveHost,
    hasActionId: Boolean(signerActionIdFromResponse),
  });

  if (effectiveHost && signerActionIdFromResponse) {
    try {
      const embedRes = await zohoRequest(
        activeZohoBase,
        `/api/v1/requests/${encodeURIComponent(requestId)}/actions/${encodeURIComponent(signerActionIdFromResponse)}/embedtoken`,
        accessToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ host: effectiveHost }).toString(),
        },
      );
      embedHttpStatus = embedRes.status;
      const embedText = await embedRes.text();
      let embedJson: { status?: string; sign_url?: string; message?: string } = {};
      try {
        embedJson = JSON.parse(embedText);
      } catch {
        embedZohoMsg = embedText.trim().slice(0, 300) || undefined;
      }
      if (embedJson.message) embedZohoMsg = embedJson.message;
      console.log("[send-agreement] new request embedtoken", { status: embedRes.status, body: embedText.slice(0, 300) });
      if (embedJson.status === "success" && embedJson.sign_url?.trim()) {
        signingUrl = embedJson.sign_url.trim();
      } else {
        console.warn("[send-agreement] embedtoken failed", { status: embedRes.status, body: embedText.slice(0, 200) });
        if (!embedZohoMsg) embedZohoMsg = embedText.trim().slice(0, 300) || undefined;
      }
    } catch (embedErr) {
      console.warn("[send-agreement] embedtoken exception", embedErr);
    }
  }

  console.log("[send-agreement] signing_url:", signingUrl ? "set" : "null");

  const signingUrlError = signingUrl
    ? null
    : !effectiveHost
      ? "No HTTPS embed host. Set NEXT_PUBLIC_APP_URL=https://your-domain.com (restart npm run dev) or set Supabase Edge secret ZOHO_SIGN_EMBED_HOST."
      : !signerActionIdFromResponse
        ? "Zoho did not return a signer action_id; check the Sign template/recipient mapping."
        : embedZohoMsg
          ? `Zoho Sign embedtoken: ${embedZohoMsg}`
          : embedHttpStatus && embedHttpStatus >= 400
            ? `Zoho Sign embedtoken failed (HTTP ${embedHttpStatus}). Register ${effectiveHost} as an embedded-signing host in Zoho Sign and retry.`
            : `Zoho Sign did not return a signing URL. Confirm ${effectiveHost} is allowed for embedded signing in your Zoho Sign organization.`;

  try {
    const nowIso = new Date().toISOString();
    const { error: insertError } = await supabase.from("zoho_sign_requests").upsert(
      {
        tenant_id: tenantId,
        request_id: requestId,
        email,
        recipient_name: name,
        user_id: userId,
        project_id: projectId,
        template_name: templateName,
        status: "sent",
        source: "onboarding",
        zoho_document_id: zohoDocumentId,
        signing_url: signingUrl,
        raw_send_response: zohoJson,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "request_id", ignoreDuplicates: false },
    );

    if (insertError) {
      console.error("[send-agreement] supabase insert error", insertError);
      const msg = insertError.message || "";
      const code = (insertError as { code?: string }).code;
      if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
        return fail(
          "duplicate_email",
          "This email already has an onboarding agreement on file. Each address can only be used once unless the prior request was declined.",
          409,
          { message: msg },
        );
      }
      return fail("db_insert", "Failed to save record in zoho_sign_requests", 500, {
        message: insertError.message,
      });
    }
  } catch (error) {
    console.error("[send-agreement] supabase insert exception", error);
    return fail("db_insert", "Database operation failed", 500);
  }

  console.log("[send-agreement] final stage before return", "success");
  return jsonResponse({
    success: true,
    request_id: requestId,
    status: "sent",
    email,
    name,
    signing_url: signingUrl,
    zoho_document_id: zohoDocumentId,
    signing_url_error: signingUrlError,
  });
});
