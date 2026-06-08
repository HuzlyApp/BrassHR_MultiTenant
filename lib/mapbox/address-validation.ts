import type {
  AddressQueryParts,
  AddressSuggestion,
  AddressValidationResult,
} from "@/lib/mapbox/address-validation-types"
import {
  parseMapboxFeatureToSuggestion,
  type MapboxGeocodeFeature,
} from "@/lib/mapbox/parse-mapbox-feature"

/** Minimum characters before calling Mapbox. */
export const ADDRESS_QUERY_MIN_LENGTH = 3

/** Relevance required to accept a single match as verified. */
export const MAPBOX_MIN_VALID_RELEVANCE = 0.75

/** Suggestions below this relevance are dropped from ambiguous lists. */
export const MAPBOX_MIN_SUGGESTION_RELEVANCE = 0.45

/** If the top two matches are within this gap, treat as ambiguous. */
export const MAPBOX_AMBIGUITY_RELEVANCE_GAP = 0.08

function normalizeAddressPart(value: string | undefined): string {
  return (value ?? "").trim()
}

/** Skip address2 when it repeats address1 (common when resume parsing copies the same line). */
function address2ForQuery(address1: string, address2: string): string {
  if (!address2) return ""
  if (!address1) return address2
  if (address1.localeCompare(address2, undefined, { sensitivity: "accent" }) === 0) {
    return ""
  }
  return address2
}

export function buildAddressQuery(parts: AddressQueryParts): string {
  const address1 = normalizeAddressPart(parts.address1)
  const address2 = address2ForQuery(address1, normalizeAddressPart(parts.address2))
  return [address1, address2, parts.city, parts.state, parts.zipCode]
    .map((s) => (typeof s === "string" ? s : (s ?? "")).trim())
    .filter(Boolean)
    .join(", ")
}

function rankSuggestions(features: MapboxGeocodeFeature[]): AddressSuggestion[] {
  return features
    .map(parseMapboxFeatureToSuggestion)
    .filter((s): s is AddressSuggestion => s !== null)
    .filter((s) => s.confidence >= MAPBOX_MIN_SUGGESTION_RELEVANCE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}

/**
 * Evaluate Mapbox forward-geocode features for a parsed or typed address query.
 * Does not call Mapbox — use from API route and unit tests.
 */
export function evaluateMapboxGeocodeResponse(
  originalAddress: string,
  features: MapboxGeocodeFeature[]
): AddressValidationResult {
  const trimmedOriginal = originalAddress.trim()
  const suggestions = rankSuggestions(features)

  if (!trimmedOriginal) {
    return {
      originalAddress: trimmedOriginal,
      isValid: false,
      status: "invalid",
      confidence: 0,
      source: "mapbox",
    }
  }

  if (suggestions.length === 0) {
    return {
      originalAddress: trimmedOriginal,
      isValid: false,
      status: "invalid",
      confidence: 0,
      source: "mapbox",
    }
  }

  const top = suggestions[0]
  const second = suggestions[1]

  if (top.confidence < MAPBOX_MIN_VALID_RELEVANCE) {
    return {
      originalAddress: trimmedOriginal,
      isValid: false,
      status: "invalid",
      confidence: top.confidence,
      source: "mapbox",
      suggestions: suggestions.length > 1 ? suggestions : undefined,
    }
  }

  const isAmbiguous =
    Boolean(second) &&
    second.confidence >= MAPBOX_MIN_VALID_RELEVANCE &&
    top.confidence - second.confidence < MAPBOX_AMBIGUITY_RELEVANCE_GAP

  if (isAmbiguous) {
    return {
      originalAddress: trimmedOriginal,
      isValid: false,
      status: "ambiguous",
      confidence: top.confidence,
      source: "mapbox",
      suggestions,
    }
  }

  return {
    originalAddress: trimmedOriginal,
    isValid: true,
    status: "valid",
    normalizedAddress: top.normalizedAddress,
    coordinates: top.coordinates,
    confidence: top.confidence,
    source: "mapbox",
  }
}

/** User picked a Mapbox suggestion — treat as verified. */
export function validationResultFromSuggestion(
  originalAddress: string,
  suggestion: AddressSuggestion
): AddressValidationResult {
  return {
    originalAddress: originalAddress.trim(),
    isValid: true,
    status: "valid",
    normalizedAddress: suggestion.normalizedAddress,
    coordinates: suggestion.coordinates,
    confidence: suggestion.confidence,
    source: "mapbox",
  }
}

export function shouldValidateAddressQuery(query: string): boolean {
  return query.trim().length >= ADDRESS_QUERY_MIN_LENGTH
}
