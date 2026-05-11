import { NextRequest, NextResponse } from "next/server"

const API_BASE = "https://api.signeasy.com/v3/rs"
const ACCESS_TOKEN = process.env.SIGNEASY_ACCESS_TOKEN // ← store in .env (secret!)

export async function POST(req: NextRequest) {
  if (!ACCESS_TOKEN) {
    return NextResponse.json({ error: "SignEasy not configured on server" }, { status: 500 })
  }

  try {
    const { applicantId, email, name } = await req.json()

    if (!email || !name) {
      return NextResponse.json({ error: "Missing applicant details" }, { status: 400 })
    }

    // For production: use a fixed document ID if the authorization PDF is static
    // Or upload once and store the document_id
    const documentUrl = "https://your-domain.com/public/authorization/Nexus_Authorization.pdf"

    // Step 1: Upload document (skip if you pre-uploaded)
    const uploadRes = await fetch(`${API_BASE}/document/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Authorization Agreement",
        url: documentUrl,
      }),
    })

    if (!uploadRes.ok) throw new Error("Document upload failed")

    const { id: documentId } = await uploadRes.json()

    // Step 2: Create envelope (embedded)
    const envelopeRes = await fetch(`${API_BASE}/envelope`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embedded_signing: true,
        is_ordered: true,
        documents: [{ document_id: documentId }],
        recipients: [
          {
            email,
            name,
            role: "signer",
            order: 1,
          },
        ],
        // You can define fields here or let user place them
        // fields: [ ... ]
      }),
    })

    if (!envelopeRes.ok) throw new Error("Envelope creation failed")

    const envelope = await envelopeRes.json()
    const envelopeId = envelope.id

    // Step 3: Get embedded signing URL
    const signingRes = await fetch(`${API_BASE}/envelope/${envelopeId}/signing/url`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient_email: email,
        // redirect_url?: string,
      }),
    })

    if (!signingRes.ok) throw new Error("Failed to generate signing URL")

    const { url: signingUrl } = await signingRes.json()

    return NextResponse.json({ signingUrl, envelopeId })
  } catch (err: unknown) {
    console.error(err)
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}