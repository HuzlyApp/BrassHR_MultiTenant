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
  it("maps Mapbox features to street/city/full-state labels without ZIP or country", () => {
    const features: MapboxGeocodeFeature[] = [
      {
        id: "address.1",
        place_name:
          "Old Dekalb Pike, King of Prussia, Pennsylvania 19406, United States",
        center: [-75.36, 40.09],
        text: "Old Dekalb Pike",
        context: [
          { id: "place.1", text: "King of Prussia" },
          { id: "region.1", text: "Pennsylvania", short_code: "US-PA" },
          { id: "postcode.1", text: "19406" },
          { id: "country.1", text: "United States", short_code: "us" },
        ],
      },
      {
        id: "place.2",
        place_name: "Dallas County, Texas, United States",
        place_type: ["place"],
        text: "Dallas County",
        center: [-96.797, 32.7767],
        context: [
          { id: "region.2", text: "Texas", short_code: "US-TX" },
          { id: "country.2", text: "United States", short_code: "us" },
        ],
      },
      {
        id: "bad",
        place_name: "Missing coords",
      },
    ]

    expect(parsePlaceFeatures(features)).toEqual([
      {
        id: "address.1",
        placeName:
          "Old Dekalb Pike, King of Prussia, Pennsylvania 19406, United States",
        displayLabel: "Old Dekalb Pike, King of Prussia, Pennsylvania",
        zipCode: "19406",
        coordinates: { lat: 40.09, lng: -75.36 },
        placeType: null,
      },
      {
        id: "place.2",
        placeName: "Dallas County, Texas, United States",
        displayLabel: "Dallas County, Texas",
        zipCode: null,
        coordinates: { lat: 32.7767, lng: -96.797 },
        placeType: "place",
      },
    ])
  })
})
