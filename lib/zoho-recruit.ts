/**
 * Zoho Recruit OAuth + attachment upload. Server-only.
 */

type ZohoTokenResponse = {
  access_token: string
  api_domain?: string
}

export async function getZohoAccessToken(): Promise<{ accessToken: string; apiDomain: string }> {
  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho is not configured (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN)")
  }

  const accountsUrl =
    process.env.ZOHO_ACCOUNTS_URL?.replace(/\/$/, "") || "https://accounts.zoho.com"

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Zoho token error: ${res.status} ${t}`)
  }

  const data = (await res.json()) as ZohoTokenResponse
  if (!data.access_token) throw new Error("Zoho token response missing access_token")

  const apiDomain = (data.api_domain || process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com").replace(
    /\/$/,
    ""
  )

  return { accessToken: data.access_token, apiDomain }
}

/** Find first Candidate id matching email (Recruit v2 search). */
export async function findRecruitCandidateIdByEmail(
  accessToken: string,
  apiDomain: string,
  email: string
): Promise<string | null> {
  const safe = email.replace(/"/g, '\\"')
  const criteria = `(Email:equals:${safe})`
  const url = `${apiDomain}/recruit/v2/Candidates/search?criteria=${encodeURIComponent(criteria)}`

  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Zoho candidate search failed: ${res.status} ${t}`)
  }

  const json = (await res.json()) as { data?: { id?: string }[] }
  const id = json.data?.[0]?.id
  return id ?? null
}

export async function uploadCandidateAttachment(
  accessToken: string,
  apiDomain: string,
  candidateId: string,
  fileName: string,
  fileBytes: Buffer,
  mimeType: string
): Promise<void> {
  const url = `${apiDomain}/recruit/v2/Candidates/${candidateId}/Attachments`

  const blob = new Blob([new Uint8Array(fileBytes)], { type: mimeType })
  const form = new FormData()
  form.append("file", blob, fileName)

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    body: form,
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Zoho upload failed (${fileName}): ${res.status} ${t}`)
  }
}
