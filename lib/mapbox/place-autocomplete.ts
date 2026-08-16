import type { MapboxGeocodeFeature } from "@/lib/mapbox/parse-mapbox-feature"

/** Minimum characters before requesting Mapbox place suggestions for job locations. */
export const PLACE_AUTOCOMPLETE_MIN_LENGTH = 3

export const PLACE_AUTOCOMPLETE_EMPTY_MESSAGE =
  "No matching locations found. Try a city, area, or address."
export const PLACE_AUTOCOMPLETE_ERROR_MESSAGE =
  "Location search is temporarily unavailable. Please try again."

export type PlaceSuggestion = {
  id: string
  placeName: string
  coordinates: { lat: number; lng: number }
  placeType: string | null
}

export function shouldRequestPlaceAutocomplete(query: string): boolean {
  return query.trim().length >= PLACE_AUTOCOMPLETE_MIN_LENGTH
}

export function parsePlaceFeatures(features: MapboxGeocodeFeature[]): PlaceSuggestion[] {
  const suggestions: PlaceSuggestion[] = []

  for (const feature of features) {
    const placeName =
      typeof feature.place_name === "string" ? feature.place_name.trim() : ""
    if (!placeName) continue
    if (!Array.isArray(feature.center) || feature.center.length < 2) continue
    const lng = Number(feature.center[0])
    const lat = Number(feature.center[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const placeType = Array.isArray((feature as { place_type?: string[] }).place_type)
      ? ((feature as { place_type?: string[] }).place_type?.[0] ?? null)
      : null

    suggestions.push({
      id:
        typeof feature.id === "string" && feature.id.trim()
          ? feature.id
          : `${placeName}:${lng},${lat}`,
      placeName,
      coordinates: { lat, lng },
      placeType,
    })
  }

  return suggestions.slice(0, 5)
}
