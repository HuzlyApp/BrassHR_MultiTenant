import { describe, expect, it } from "vitest"
import {
  ADDRESS_QUERY_MIN_LENGTH,
  buildAddressQuery,
  evaluateMapboxGeocodeResponse,
  MAPBOX_MIN_VALID_RELEVANCE,
  shouldValidateAddressQuery,
  validationResultFromSuggestion,
} from "@/lib/mapbox/address-validation"
import type { MapboxGeocodeFeature } from "@/lib/mapbox/parse-mapbox-feature"
import { parseMapboxFeatureToSuggestion } from "@/lib/mapbox/parse-mapbox-feature"

function feature(
  place_name: string,
  relevance: number,
  center: [number, number] = [-118.2437, 34.0522]
): MapboxGeocodeFeature {
  return {
    id: `place.${place_name}`,
    place_name,
    relevance,
    center,
    address: "123",
    text: "Main St",
    context: [
      { id: "place.1", text: "Los Angeles" },
      { id: "region.1", text: "California", short_code: "US-CA" },
      { id: "postcode.1", text: "90012" },
    ],
  }
}

describe("buildAddressQuery", () => {
  it("joins non-empty parts", () => {
    expect(
      buildAddressQuery({
        address1: "123 Main St",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90012",
      })
    ).toBe("123 Main St, Los Angeles, CA, 90012")
  })

  it("returns empty for all blank parts", () => {
    expect(buildAddressQuery({})).toBe("")
  })

  it("skips address2 when it duplicates address1", () => {
    expect(
      buildAddressQuery({
        address1: "1515 West Pacific Avenue",
        address2: "1515 West Pacific Avenue",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90291",
      })
    ).toBe("1515 West Pacific Avenue, Los Angeles, CA, 90291")
  })
})

describe("shouldValidateAddressQuery", () => {
  it("is false for empty or very short input", () => {
    expect(shouldValidateAddressQuery("")).toBe(false)
    expect(shouldValidateAddressQuery("ab")).toBe(false)
    expect(shouldValidateAddressQuery("abc")).toBe(true)
  })

  it("uses ADDRESS_QUERY_MIN_LENGTH", () => {
    expect(ADDRESS_QUERY_MIN_LENGTH).toBe(3)
  })
})

describe("evaluateMapboxGeocodeResponse", () => {
  const original = "123 Main St, Los Angeles, CA 90012"

  it("returns invalid for empty query", () => {
    const result = evaluateMapboxGeocodeResponse("", [])
    expect(result.isValid).toBe(false)
    expect(result.status).toBe("invalid")
    expect(result.confidence).toBe(0)
    expect(result.source).toBe("mapbox")
  })

  it("returns invalid when Mapbox returns no features", () => {
    const result = evaluateMapboxGeocodeResponse(original, [])
    expect(result.isValid).toBe(false)
    expect(result.status).toBe("invalid")
    expect(result.originalAddress).toBe(original)
  })

  it("returns invalid for low-confidence match", () => {
    const result = evaluateMapboxGeocodeResponse(original, [
      feature("123 Main St, Los Angeles, CA 90012, United States", 0.4),
    ])
    expect(result.isValid).toBe(false)
    expect(result.status).toBe("invalid")
    expect(result.confidence).toBeLessThan(MAPBOX_MIN_VALID_RELEVANCE)
  })

  it("returns valid for a high-confidence single match", () => {
    const place = "123 Main St, Los Angeles, California 90012, United States"
    const result = evaluateMapboxGeocodeResponse(original, [feature(place, 0.95)])
    expect(result.isValid).toBe(true)
    expect(result.status).toBe("valid")
    expect(result.normalizedAddress).toBe(place)
    expect(result.coordinates).toEqual({ lat: 34.0522, lng: -118.2437 })
    expect(result.confidence).toBeGreaterThanOrEqual(MAPBOX_MIN_VALID_RELEVANCE)
  })

  it("returns ambiguous when top matches are similarly confident", () => {
    const result = evaluateMapboxGeocodeResponse(original, [
      feature("123 Main St, Los Angeles, CA", 0.92),
      feature("123 Main Street, Los Angeles, CA", 0.9),
    ])
    expect(result.isValid).toBe(false)
    expect(result.status).toBe("ambiguous")
    expect(result.suggestions?.length).toBeGreaterThanOrEqual(2)
  })

  it("accepts user-selected suggestion as valid", () => {
    const suggestion = parseMapboxFeatureToSuggestion(
      feature("456 Oak Ave, Austin, TX 78701, United States", 0.88)
    )
    expect(suggestion).not.toBeNull()
    const result = validationResultFromSuggestion(original, suggestion!)
    expect(result.isValid).toBe(true)
    expect(result.normalizedAddress).toContain("Oak Ave")
  })
})
