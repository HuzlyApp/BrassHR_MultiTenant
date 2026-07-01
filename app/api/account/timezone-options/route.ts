import { NextResponse } from "next/server"
import { loadReferenceUsTimezones } from "@/lib/account/reference-timezones"
import { groupTimezoneOptionsByRegion } from "@/lib/account/us-timezones"
import { formatApiError } from "@/lib/api/format-api-error"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) throw authError
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const options = await loadReferenceUsTimezones(supabase)
    const regions = groupTimezoneOptionsByRegion(options)

    return NextResponse.json(
      { options, regions },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    )
  } catch (err) {
    console.error("[account/timezone-options GET]", err)
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 })
  }
}
