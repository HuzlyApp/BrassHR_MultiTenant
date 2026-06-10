/**
 * Zoho Sign embedded signing via REST + OAuth refresh token.
 *
 * Flow:
 * - refresh access token
 * - create request (multipart with file + data, with is_embedded: true)
 * - submit request
 * - generate embedtoken URL (sign_url)
 */

import { normalizeZohoEmbedHostCandidate } from "@/lib/zoho-sign-embed-host"

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function accountsHost(): string {
  return (process.env.ZOHO_ACCOUNTS_HOST || "https://accounts.zoho.com").replace(/\/$/, "")
}

function signApiBase(): string {
  return (process.env.ZOHO_SIGN_API_BASE || "https://sign.zoho.com").replace(/\/$/, "")
}

async function getAccessToken(): Promise<string> {
  const clientId = requireEnv("ZOHO_SIGN_CLIENT_ID")
  const clientSecret = requireEnv("ZOHO_SIGN_CLIENT_SECRET")
  const refreshToken = requireEnv("ZOHO_SIGN_REFRESH_TOKEN")

  const tokenUrl = `${accountsHost()}/oauth/v2/token`
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  })

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Zoho OAuth failed: ${res.status} ${t}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("Zoho token response missing access_token")
  return data.access_token
}

type ZohoRequestGetResponse = {
  status?: string
  message?: string
  requests?: {
    request_id?: string
    request_status?: string
    actions?: Array<{
      action_id?: string
      recipient_email?: string
      recipient_name?: string
      action_type?: string
      is_embedded?: boolean
    }>
  }
}



function maybeRedirectPages(returnUrl: string) {
  // Zoho Sign rejects non-https redirect URLs (commonly shows "Url has invalid scheme").
  // In local dev we often run on http://localhost, so omit redirects there.
  if (!/^https:\/\//i.test(returnUrl)) return undefined
  return {
    sign_success: returnUrl,
    sign_completed: returnUrl,
    sign_declined: returnUrl,
    sign_later: returnUrl,
  }
}

type ZohoCreateResponse = {
  status?: string
  message?: string
  requests?: {
    request_id?: string
    request_status?: string
    document_ids?: Array<{ document_id?: string; document_name?: string }>
    actions?: Array<{ action_id?: string; recipient_email?: string; recipient_name?: string; action_type?: string }>
  }
}

type ZohoEmbedTokenResponse = {
  status?: string
  message?: string
  sign_url?: string
}

type ZohoTemplateGetResponse = {
  status?: string
  message?: string
  templates?: {
    template_id?: string
    template_name?: string
    actions?: Array<{
      action_id?: string
      action_type?: string
      role?: string
      recipient_name?: string
      recipient_email?: string
    }>
  }
}

type ZohoTemplateCreateDocumentResponse = {
  status?: string
  message?: string
  requests?: {
    request_id?: string
    actions?: Array<{ action_id?: string; action_type?: string; recipient_email?: string }>
  }
}

async function generateEmbedSigningUrl(params: {
  requestId: string
  actionId: string
  returnUrl: string
  publicOrigin?: string
}): Promise<{ signingUrl: string; requestId: string; actionId: string }> {
  const accessToken = await getAccessToken()
  const base = signApiBase()

  const explicitHost = normalizeZohoEmbedHostCandidate(process.env.ZOHO_SIGN_EMBED_HOST || "")
  const fromPublic =
    normalizeZohoEmbedHostCandidate(params.publicOrigin || "") ||
    normalizeZohoEmbedHostCandidate(process.env.NEXT_PUBLIC_APP_URL || "")
  let fromReturn = ""
  try {
    fromReturn = normalizeZohoEmbedHostCandidate(new URL(params.returnUrl).origin)
  } catch {
    /* ignore */
  }
  const host = explicitHost || fromPublic || fromReturn

  if (!host) {
    throw new Error(
      "Zoho Sign embedded signing requires an https host. Set ZOHO_SIGN_EMBED_HOST or NEXT_PUBLIC_APP_URL to your public https domain (e.g. https://hr.brasshr.com)."
    )
  }

  const embedBody = new URLSearchParams({ host })

  const embedRes = await fetch(
    `${base}/api/v1/requests/${encodeURIComponent(params.requestId)}/actions/${encodeURIComponent(params.actionId)}/embedtoken`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: embedBody.toString(),
    }
  )

  const embedText = await embedRes.text()
  const embedJson = (() => {
    try {
      return JSON.parse(embedText) as ZohoEmbedTokenResponse
    } catch {
      return {} as ZohoEmbedTokenResponse
    }
  })()

  if (!embedRes.ok || embedJson.status !== "success" || !embedJson.sign_url) {
    throw new Error(
      `Zoho Sign embedtoken failed: ${embedRes.status} ${embedJson.message || embedText || "Unknown error"}`
    )
  }

  return { signingUrl: embedJson.sign_url, requestId: params.requestId, actionId: params.actionId }
}

export async function createZohoEmbeddedSigningUrlForExistingRequest(params: {
  requestId: string
  /** if omitted, will pick first SIGN action or match by recipientEmail */
  actionId?: string
  recipientEmail?: string
  returnUrl: string
  publicOrigin?: string
}): Promise<{ signingUrl: string; requestId: string; actionId: string }> {
  const accessToken = await getAccessToken()
  const base = signApiBase()

  const reqRes = await fetch(`${base}/api/v1/requests/${encodeURIComponent(params.requestId)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const reqText = await reqRes.text()
  const reqJson = (() => {
    try {
      return JSON.parse(reqText) as ZohoRequestGetResponse
    } catch {
      return {} as ZohoRequestGetResponse
    }
  })()

  if (!reqRes.ok || reqJson.status !== "success") {
    throw new Error(
      `Zoho Sign get request failed: ${reqRes.status} ${reqJson.message || reqText || "Unknown error"}`
    )
  }

  const actions = reqJson.requests?.actions || []
  let actionId = params.actionId?.trim() || ""

  if (!actionId) {
    const targetEmail = (params.recipientEmail || "").trim().toLowerCase()
    const match =
      (targetEmail
        ? actions.find((a) => (a.recipient_email || "").trim().toLowerCase() === targetEmail)
        : undefined) || actions.find((a) => a.action_type === "SIGN") || actions[0]
    actionId = (match?.action_id || "").trim()
  }

  if (!actionId) throw new Error("Could not determine Zoho Sign action_id for embedded signing")

  return await generateEmbedSigningUrl({
    requestId: params.requestId,
    actionId,
    returnUrl: params.returnUrl,
    publicOrigin: params.publicOrigin,
  })
}

export async function createZohoEmbeddedSigningFromTemplate(params: {
  templateId: string
  email: string
  name: string
  returnUrl: string
  publicOrigin?: string
}): Promise<{ signingUrl: string; requestId: string; actionId: string }> {
  const accessToken = await getAccessToken()
  const base = signApiBase()

  // Fetch template to get the template action_id(s)
  const tRes = await fetch(`${base}/api/v1/templates/${encodeURIComponent(params.templateId)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const tText = await tRes.text()
  const tJson = (() => {
    try {
      return JSON.parse(tText) as ZohoTemplateGetResponse
    } catch {
      return {} as ZohoTemplateGetResponse
    }
  })()

  if (!tRes.ok || tJson.status !== "success") {
    throw new Error(
      `Zoho Sign get template failed: ${tRes.status} ${tJson.message || tText || "Unknown error"}`
    )
  }

  const templateActionId =
    (tJson.templates?.actions || []).find((a) => a.action_type === "SIGN")?.action_id ||
    tJson.templates?.actions?.[0]?.action_id ||
    ""

  if (!templateActionId) throw new Error("Zoho Sign template missing action_id")

  // Create a request from the template (quicksend so it’s ready for signing)
  const createData = {
    templates: {
      request_name: tJson.templates?.template_name || "Authorization release form",
      field_data: {
        field_text_data: {},
        field_boolean_data: {},
        field_date_data: {},
      },
      actions: [
        {
          action_id: String(templateActionId),
          action_type: "SIGN",
          recipient_name: params.name,
          recipient_email: params.email,
          verify_recipient: false,
          is_embedded: true,
        },
      ],
      notes: "",
      ...(maybeRedirectPages(params.returnUrl)
        ? { redirect_pages: maybeRedirectPages(params.returnUrl) }
        : {}),
    },
  }

  const createBody = new URLSearchParams({
    data: JSON.stringify(createData),
  })

  const createRes = await fetch(
    `${base}/api/v1/templates/${encodeURIComponent(params.templateId)}/createdocument?is_quicksend=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: createBody.toString(),
    }
  )

  const cText = await createRes.text()
  const cJson = (() => {
    try {
      return JSON.parse(cText) as ZohoTemplateCreateDocumentResponse
    } catch {
      return {} as ZohoTemplateCreateDocumentResponse
    }
  })()

  if (!createRes.ok || cJson.status !== "success") {
    throw new Error(
      `Zoho Sign createdocument failed: ${createRes.status} ${cJson.message || cText || "Unknown error"}`
    )
  }

  const requestId = (cJson.requests?.request_id || "").trim()
  const actionId =
    (cJson.requests?.actions || []).find((a) => a.action_type === "SIGN")?.action_id ||
    cJson.requests?.actions?.[0]?.action_id ||
    ""

  if (!requestId || !actionId) throw new Error("Zoho Sign createdocument response missing request_id/action_id")

  return await generateEmbedSigningUrl({
    requestId,
    actionId: String(actionId),
    returnUrl: params.returnUrl,
    publicOrigin: params.publicOrigin,
  })
}



