import { NextResponse } from "next/server"
import {
  PLACE_AUTOCOMPLETE_MIN_LENGTH,
  parsePlaceFeatures,
} from "@/lib/mapbox/place-autocomplete"
import type { MapboxGeocodeFeature } from "@/lib/mapbox/parse-mapbox-feature"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

function getMapboxToken(): string | null {
  return (
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    null
  )
}

/** Job-location search: cities, neighborhoods, postcodes, and street addresses. */
export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "address-places",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_PUBLIC_API_PER_MINUTE ?? 60),
      windowMs: 60 * 1000,
      failClosed: false,
    })
    if (limited) return limited

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const query =
      typeof body?.query === "string"
        ? body.query.trim()
        : typeof body?.address1 === "string"
          ? body.address1.trim()
          : ""

    if (query.length < PLACE_AUTOCOMPLETE_MIN_LENGTH) {
      return NextResponse.json(
        { error: "Location query is too short", code: "QUERY_TOO_SHORT" },
        { status: 400 }
      )
    }

    const token = getMapboxToken()
    if (!token) {
      return NextResponse.json(
        { error: "Mapbox is not configured", code: "MAPBOX_NOT_CONFIGURED" },
        { status: 503 }
      )
    }

    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    )
    url.searchParams.set("access_token", token)
    url.searchParams.set("limit", "5")
    url.searchParams.set("autocomplete", "true")
    url.searchParams.set("country", "US")
    url.searchParams.set(
      "types",
      "place,locality,neighborhood,district,postcode,address"
    )

    const mapboxRes = await fetch(url.toString(), { cache: "no-store" })
    if (!mapboxRes.ok) {
      const text = await mapboxRes.text().catch(() => "")
      console.error("[address/places] mapbox", mapboxRes.status, text.slice(0, 200))
      return NextResponse.json(
        { error: "Location search failed", code: "MAPBOX_ERROR" },
        { status: 502 }
      )
    }

    const data = (await mapboxRes.json()) as { features?: MapboxGeocodeFeature[] }
    const features = Array.isArray(data.features) ? data.features : []
    const suggestions = parsePlaceFeatures(features)

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error("[address/places]", err)
    return NextResponse.json(
      { error: "Location search failed", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
