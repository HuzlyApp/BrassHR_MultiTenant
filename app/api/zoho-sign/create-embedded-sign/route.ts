import { NextRequest, NextResponse } from "next/server"
import { resolveAppOrigin } from "@/lib/resolve-app-origin"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import {
  createZohoEmbeddedSigningFromTemplate,
  createZohoEmbeddedSigningUrlForExistingRequest,
} from "@/lib/zoho-sign-embedded"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicantId = body.applicantId as string | undefined
    const email = (body.email as string | undefined)?.trim()
    const name = (body.name as string | undefined)?.trim()
    const origin = body.origin as string | undefined
    const existingRequestId = (body.requestId as string | undefined)?.trim()
    const existingActionId = (body.actionId as string | undefined)?.trim()
    const templateId =
      (body.templateId as string | undefined)?.trim() || process.env.ZOHO_SIGN_TEMPLATE_ID?.trim() || ""

    if (!applicantId || !email || !name) {
      return NextResponse.json({ error: "Missing applicantId, email, or name" }, { status: 400 })
    }

    const appUrl = resolveAppOrigin(req, origin)
    if (!appUrl) {
      return NextResponse.json(
        {
          error:
            "Could not determine app URL for signing return. Open the app in the browser (or set NEXT_PUBLIC_APP_URL).",
        },
        { status: 500 }
      )
    }

    const returnUrl = `${appUrl}/application/zoho-sign-callback`

    const { signingUrl, requestId, actionId } = existingRequestId
      ? await createZohoEmbeddedSigningUrlForExistingRequest({
          requestId: existingRequestId,
          actionId: existingActionId || undefined,
          recipientEmail: email,
          returnUrl,
          publicOrigin: appUrl,
        })
      : await createZohoEmbeddedSigningFromTemplate({
          templateId: templateId || process.env.ZOHO_SIGN_TEMPLATE_ID || "",
          email,
          name,
          returnUrl,
          publicOrigin: appUrl,
        })

    if (!templateId && !existingRequestId && !process.env.ZOHO_SIGN_TEMPLATE_ID) {
      console.warn("[zoho-sign/create-embedded-sign] No template ID provided and ZOHO_SIGN_TEMPLATE_ID not set")
    }

    // Record the request so the Zoho webhook can update status on completion.
    const supabaseUrl = getSupabaseUrl()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data: workerRow } = await supabase
          .from("worker")
          .select("tenant_id")
          .eq("user_id", applicantId)
          .maybeSingle()
        const tenantId = workerRow?.tenant_id != null ? String(workerRow.tenant_id) : null
        if (tenantId) {
          await supabase
            .from("agreements")
            .upsert(
              {
                tenant_id: tenantId,
                request_id: requestId,
                applicant_id: applicantId,
                status: "sent",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "request_id", ignoreDuplicates: false }
            )
        } else {
          console.warn(
            "[zoho-sign/create-embedded-sign] skip agreements upsert: worker has no tenant_id for applicant",
            applicantId,
          )
        }
      } catch (e) {
        console.warn("[zoho-sign/create-embedded-sign] could not upsert agreements row", e)
      }
    }

    return NextResponse.json({ signingUrl, requestId, actionId, signingCompleteManual: true })
  } catch (err: unknown) {
    console.error("[zoho-sign/create-embedded-sign]", err)
    const msg = err instanceof Error ? err.message : "Signing session error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

