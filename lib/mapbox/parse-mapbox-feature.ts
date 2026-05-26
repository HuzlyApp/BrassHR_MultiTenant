import type {
  AddressSuggestion,
  AddressValidationCoordinates,
  ParsedAddressComponents,
} from "@/lib/mapbox/address-validation-types"

export type MapboxGeocodeFeature = {
  id?: string
  place_name?: string
  relevance?: number
  center?: [number, number]
  address?: string
  text?: string
  context?: Array<{
    id?: string
    text?: string
    short_code?: string
  }>
}

function contextText(
  context: MapboxGeocodeFeature["context"],
  prefix: string
): string {
  if (!context?.length) return ""
  const item = context.find((c) => c.id?.startsWith(prefix))
  return item?.text?.trim() ?? ""
}

function contextShortCode(
  context: MapboxGeocodeFeature["context"],
  prefix: string
): string {
  if (!context?.length) return ""
  const item = context.find((c) => c.id?.startsWith(prefix))
  const code = item?.short_code?.trim() ?? ""
  if (prefix === "region" && code.includes("-")) {
    return code.split("-").pop()?.toUpperCase() ?? code
  }
  return code.toUpperCase()
}

export function parseAddressComponentsFromFeature(
  feature: MapboxGeocodeFeature
): ParsedAddressComponents {
  const streetNumber = feature.address?.trim() ?? ""
  const streetName = feature.text?.trim() ?? ""
  const line1 =
    [streetNumber, streetName].filter(Boolean).join(" ").trim() ||
    (feature.place_name?.split(",")[0]?.trim() ?? "")

  const city =
    contextText(feature.context, "place") ||
    contextText(feature.context, "locality") ||
    contextText(feature.context, "district")

  const state =
    contextShortCode(feature.context, "region") ||
    contextText(feature.context, "region")

  const zipCode = contextText(feature.context, "postcode").replace(/\D/g, "").slice(0, 5)

  return {
    address1: line1,
    address2: "",
    city,
    state,
    zipCode,
  }
}

export function parseMapboxFeatureToSuggestion(
  feature: unknown
): AddressSuggestion | null {
  if (feature == null || typeof feature !== "object") return null
  const f = feature as MapboxGeocodeFeature
  const placeName = typeof f.place_name === "string" ? f.place_name.trim() : ""
  if (!placeName) return null
  if (!Array.isArray(f.center) || f.center.length < 2) return null
  const lng = Number(f.center[0])
  const lat = Number(f.center[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const confidence =
    typeof f.relevance === "number" && Number.isFinite(f.relevance) ? f.relevance : 0
  const coordinates: AddressValidationCoordinates = { lat, lng }
  const id = typeof f.id === "string" && f.id.trim() ? f.id : placeName

  return {
    id,
    placeName,
    normalizedAddress: placeName,
    coordinates,
    confidence,
    components: parseAddressComponentsFromFeature(f),
  }
}
