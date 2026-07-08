import type { AddressQueryParts, AddressSuggestion } from "@/lib/mapbox/address-validation-types"
import {
  parseMapboxFeatureToSuggestion,
  type MapboxGeocodeFeature,
} from "@/lib/mapbox/parse-mapbox-feature"

/** Minimum characters in Address Line 1 before requesting autocomplete suggestions. */
export const ADDRESS_AUTOCOMPLETE_MIN_LENGTH = 3

export const ADDRESS_AUTOCOMPLETE_EMPTY_MESSAGE = "No matching addresses found. Try a different search."
export const ADDRESS_AUTOCOMPLETE_ERROR_MESSAGE =
  "Address search is temporarily unavailable. Please try again."
export const ADDRESS_NOT_VERIFIED_MESSAGE =
  "Select a street address from the suggestions to continue."

function normalizePart(value: string | undefined): string {
  return (value ?? "").trim()
}

/**
 * Build a Mapbox forward-geocode query for street-address autocomplete.
 * Biases results toward the selected city/state when available.
 */
export function buildAutocompleteSearchQuery(parts: AddressQueryParts): string {
  const street = normalizePart(parts.address1)
  if (!street) return ""

  const locality = [parts.city, parts.state, parts.zipCode]
    .map((part) => normalizePart(part))
    .filter(Boolean)
    .join(", ")

  return locality ? `${street}, ${locality}` : street
}

export function shouldRequestAddressAutocomplete(address1: string): boolean {
  return normalizePart(address1).length >= ADDRESS_AUTOCOMPLETE_MIN_LENGTH
}

function isStreetAddressFeature(feature: MapboxGeocodeFeature): boolean {
  const placeType = (feature as { place_type?: string[] }).place_type
  if (!placeType?.length) return true
  return placeType.includes("address")
}

/** Parse Mapbox autocomplete features into ranked street-address suggestions. */
export function parseAutocompleteFeatures(features: MapboxGeocodeFeature[]): AddressSuggestion[] {
  return features
    .filter(isStreetAddressFeature)
    .map(parseMapboxFeatureToSuggestion)
    .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null)
    .filter((suggestion) => Boolean(suggestion.components.address1.trim()))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}
