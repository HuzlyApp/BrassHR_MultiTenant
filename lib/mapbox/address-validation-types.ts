/** Structured address validation result (Mapbox forward geocoding). */
export type AddressValidationCoordinates = {
  lat: number
  lng: number
}

export type ParsedAddressComponents = {
  address1: string
  address2: string
  city: string
  state: string
  zipCode: string
}

export type AddressSuggestion = {
  id: string
  placeName: string
  normalizedAddress: string
  coordinates: AddressValidationCoordinates
  confidence: number
  components: ParsedAddressComponents
}

export type AddressValidationStatus = "valid" | "invalid" | "ambiguous"

export type AddressValidationResult = {
  originalAddress: string
  isValid: boolean
  status: AddressValidationStatus
  normalizedAddress?: string
  coordinates?: AddressValidationCoordinates
  confidence: number
  source: "mapbox"
  suggestions?: AddressSuggestion[]
}

export type AddressQueryParts = {
  address1?: string
  address2?: string
  city?: string
  state?: string
  zipCode?: string
}

export const ADDRESS_INVALID_MESSAGE =
  "We couldn't verify this address. Please enter a valid address or location."

export const ADDRESS_AMBIGUOUS_MESSAGE =
  "This address matches multiple locations. Please select the correct one."
