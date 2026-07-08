import { describe, expect, it } from "vitest"
import {
  ADDRESS_AUTOCOMPLETE_MIN_LENGTH,
  buildAutocompleteSearchQuery,
  parseAutocompleteFeatures,
  shouldRequestAddressAutocomplete,
} from "@/lib/mapbox/address-autocomplete"
import type { MapboxGeocodeFeature } from "@/lib/mapbox/parse-mapbox-feature"

function addressFeature(
  place_name: string,
  relevance: number,
  center: [number, number] = [-79.0753, 35.9101]
): MapboxGeocodeFeature {
  return {
    id: `address.${place_name}`,
    place_name,
    relevance,
    center,
    place_type: ["address"],
    address: "100",
    text: "Main Street",
    context: [
      { id: "place.1", text: "Carrboro" },
      { id: "region.1", text: "North Carolina", short_code: "US-NC" },
      { id: "postcode.1", text: "27510" },
    ],
  }
}

describe("buildAutocompleteSearchQuery", () => {
  it("biases search with selected city and state", () => {
    expect(
      buildAutocompleteSearchQuery({
        address1: "100 Main",
        city: "Carrboro",
        state: "North Carolina",
      })
    ).toBe("100 Main, Carrboro, North Carolina")
  })

  it("uses street input only when locality is missing", () => {
    expect(buildAutocompleteSearchQuery({ address1: "100 Main" })).toBe("100 Main")
  })
})

describe("shouldRequestAddressAutocomplete", () => {
  it("requires minimum street input length", () => {
    expect(shouldRequestAddressAutocomplete("ab")).toBe(false)
    expect(shouldRequestAddressAutocomplete("100")).toBe(true)
    expect(ADDRESS_AUTOCOMPLETE_MIN_LENGTH).toBe(3)
  })
})

describe("parseAutocompleteFeatures", () => {
  it("returns street-address suggestions with parsed components", () => {
    const suggestions = parseAutocompleteFeatures([
      addressFeature("100 Main Street, Carrboro, North Carolina 27510, United States", 0.92),
    ])

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.components.address1).toBe("100 Main Street")
    expect(suggestions[0]?.components.city).toBe("Carrboro")
    expect(suggestions[0]?.components.state).toBe("NC")
    expect(suggestions[0]?.components.zipCode).toBe("27510")
  })

  it("drops non-address features", () => {
    const suggestions = parseAutocompleteFeatures([
      {
        id: "place.carrboro",
        place_name: "Carrboro, North Carolina, United States",
        relevance: 0.9,
        center: [-79.0753, 35.9101],
        place_type: ["place"],
        text: "Carrboro",
      },
    ])

    expect(suggestions).toHaveLength(0)
  })
})
