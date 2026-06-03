import { NextResponse } from "next/server"
import {
  ADDRESS_QUERY_MIN_LENGTH,
  buildAddressQuery,
  evaluateMapboxGeocodeResponse,
} from "@/lib/mapbox/address-validation"
import type { AddressQueryParts } from "@/lib/mapbox/address-validation-types"
import type { MapboxGeocodeFeature } from "@/lib/mapbox/parse-mapbox-feature"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

function getMapboxToken(): string | null {
  return (
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    null
  )
}

function parseQueryParts(body: Record<string, unknown>): AddressQueryParts {
  return {
    address1: typeof body.address1 === "string" ? body.address1 : undefined,
    address2: typeof body.address2 === "string" ? body.address2 : undefined,
    city: typeof body.city === "string" ? body.city : undefined,
    state: typeof body.state === "string" ? body.state : undefined,
    zipCode:
      typeof body.zipCode === "string"
        ? body.zipCode
        : typeof body.zip === "string"
          ? body.zip
          : undefined,
  }
}

export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "address-validate",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_PUBLIC_API_PER_MINUTE ?? 60),
      windowMs: 60 * 1000,
      failClosed: false,
    })
    if (limited) return limited

    const body = (await req.json()) as Record<string, unknown>
    const queryFromBody =
      typeof body.query === "string" ? body.query.trim() : ""
    const parts = parseQueryParts(body)
    const query = queryFromBody || buildAddressQuery(parts)

    if (query.length < ADDRESS_QUERY_MIN_LENGTH) {
      return NextResponse.json(
        {
          error: "Address query is too short",
          code: "QUERY_TOO_SHORT",
        },
        { status: 400 }
      )
    }

    const token = getMapboxToken()
    if (!token) {
      return NextResponse.json(
        {
          error: "Mapbox is not configured",
          code: "MAPBOX_NOT_CONFIGURED",
        },
        { status: 503 }
      )
    }

    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    )
    url.searchParams.set("access_token", token)
    url.searchParams.set("limit", "5")
    url.searchParams.set("autocomplete", "false")
    url.searchParams.set("country", "US")

    const mapboxRes = await fetch(url.toString(), { cache: "no-store" })
    if (!mapboxRes.ok) {
      const text = await mapboxRes.text().catch(() => "")
      console.error("[address/validate] mapbox", mapboxRes.status, text.slice(0, 200))
      return NextResponse.json(
        { error: "Address verification failed", code: "MAPBOX_ERROR" },
        { status: 502 }
      )
    }

    const data = (await mapboxRes.json()) as { features?: MapboxGeocodeFeature[] }
    const features = Array.isArray(data.features) ? data.features : []
    const result = evaluateMapboxGeocodeResponse(query, features)

    return NextResponse.json(result)
  } catch (err) {
    console.error("[address/validate]", err)
    return NextResponse.json(
      { error: "Address verification failed", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
