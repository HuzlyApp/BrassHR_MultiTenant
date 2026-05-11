const DEFAULT_ACCOUNTS_HOST = "https://accounts.zoho.com";
const DEFAULT_SIGN_API_BASE = "https://sign.zoho.com";
declare const Deno: { env: { get: (name: string) => string | undefined } };

type ZohoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type ZohoTemplate = {
  template_id?: string;
  template_name?: string;
};

type ZohoTemplatesResponse = {
  status?: string;
  message?: string;
  templates?: ZohoTemplate[];
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getZohoAccountsHost(): string {
  return (Deno.env.get("ZOHO_ACCOUNTS_HOST")?.trim() || DEFAULT_ACCOUNTS_HOST).replace(/\/$/, "");
}

export function getZohoSignApiBase(): string {
  return (Deno.env.get("ZOHO_SIGN_API_BASE")?.trim() || DEFAULT_SIGN_API_BASE).replace(/\/$/, "");
}

export async function getZohoAccessToken(): Promise<string> {
  const clientId = requireEnv("ZOHO_SIGN_CLIENT_ID");
  const clientSecret = requireEnv("ZOHO_SIGN_CLIENT_SECRET");
  const refreshToken = requireEnv("ZOHO_SIGN_REFRESH_TOKEN");
  const tokenUrl = `${getZohoAccountsHost()}/oauth/v2/token`;

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const rawText = await res.text();
  let parsed: ZohoTokenResponse = {};
  try {
    parsed = JSON.parse(rawText) as ZohoTokenResponse;
  } catch {
    // Keep parsed as empty object and include raw text in thrown error.
  }

  if (!res.ok || !parsed.access_token) {
    const details =
      parsed.error_description ||
      parsed.error ||
      rawText ||
      `Zoho OAuth returned HTTP ${res.status}`;
    throw new Error(`Failed to exchange refresh token for access token: ${details}`);
  }

  return parsed.access_token;
}

export async function zohoApiFetch(
  path: string,
  init: RequestInit & { accessToken: string },
): Promise<Response> {
  const url = `${getZohoSignApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Zoho-oauthtoken ${init.accessToken}`);

  return await fetch(url, {
    method: init.method || "GET",
    headers,
    body: init.body,
  });
}

export async function resolveTemplateId(templateName = "Onboarding Agreement"): Promise<string> {
  const explicitTemplateId = Deno.env.get("ZOHO_SIGN_TEMPLATE_ID")?.trim();
  if (explicitTemplateId) return explicitTemplateId;

  const accessToken = await getZohoAccessToken();
  const listRes = await zohoApiFetch("/api/v1/templates", { accessToken });
  const listText = await listRes.text();

  let listJson: ZohoTemplatesResponse = {};
  try {
    listJson = JSON.parse(listText) as ZohoTemplatesResponse;
  } catch {
    throw new Error(`Unable to parse Zoho template list response: ${listText}`);
  }

  if (!listRes.ok || listJson.status !== "success") {
    throw new Error(
      `Unable to list Zoho templates while resolving template_id: ${listRes.status} ${listJson.message || listText}`,
    );
  }

  const targetName = templateName.trim().toLowerCase();
  const matched = (listJson.templates || []).find(
    (template) => (template.template_name || "").trim().toLowerCase() === targetName,
  );

  const templateId = matched?.template_id?.trim();
  if (!templateId) {
    throw new Error(
      `Template "${templateName}" not found. Set ZOHO_SIGN_TEMPLATE_ID explicitly to avoid runtime lookup.`,
    );
  }

  return templateId;
}
