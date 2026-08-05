import { describe, expect, it } from "vitest"
import {
  parsePlaceFeatures,
  shouldRequestPlaceAutocomplete,
} from "@/lib/mapbox/place-autocomplete"
import type { MapboxGeocodeFeature } from "@/lib/mapbox/parse-mapbox-feature"

describe("shouldRequestPlaceAutocomplete", () => {
  it("requires at least 3 characters", () => {
    expect(shouldRequestPlaceAutocomplete("ab")).toBe(false)
    expect(shouldRequestPlaceAutocomplete("dal")).toBe(true)
  })
})

describe("parsePlaceFeatures", () => {
  it("maps Mapbox features into place suggestions", () => {
    const features: MapboxGeocodeFeature[] = [
      {
        id: "place.1",
        place_name: "Dallas, Texas, United States",
        center: [-96.797, 32.7767],
        relevance: 0.99,
      },
      {
        id: "bad",
        place_name: "Missing coords",
      },
    ]

    expect(parsePlaceFeatures(features)).toEqual([
      {
        id: "place.1",
        placeName: "Dallas, Texas, United States",
        coordinates: { lat: 32.7767, lng: -96.797 },
        placeType: null,
      },
    ])
  })
})
