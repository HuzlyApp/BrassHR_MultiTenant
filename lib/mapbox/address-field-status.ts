import { shouldValidateAddressQuery } from "@/lib/mapbox/address-validation"
import {
  ADDRESS_AMBIGUOUS_MESSAGE,
  ADDRESS_INVALID_MESSAGE,
  type AddressSuggestion,
} from "@/lib/mapbox/address-validation-types"
import type { useAddressValidation } from "@/lib/mapbox/use-address-validation"

export type AddressFieldStatusTone = "success" | "error" | "neutral"

export type AddressFieldStatus = {
  statusMessage: string | null
  statusTone: AddressFieldStatusTone
  suggestions: AddressSuggestion[]
}

/**
 * Derive the UI status (verifying / verified / invalid) + suggestion list from an
 * `useAddressValidation` result. Shared by the tenant signup and business info forms so
 * their custom-styled address inputs can show the same Mapbox feedback as the applicant flow.
 */
export function getAddressFieldStatus(
  validation: ReturnType<typeof useAddressValidation>
): AddressFieldStatus {
  const show = shouldValidateAddressQuery(validation.query)

  let statusMessage: string | null = null
  let statusTone: AddressFieldStatusTone = "neutral"

  if (show) {
    if (validation.isValidating) {
      statusMessage = "Verifying address…"
      statusTone = "neutral"
    } else if (validation.validationResult?.isValid) {
      statusMessage = "Address verified."
      statusTone = "success"
    } else if (validation.validationResult?.status === "ambiguous") {
      statusMessage = ADDRESS_AMBIGUOUS_MESSAGE
      statusTone = "error"
    } else if (validation.validationResult?.status === "invalid") {
      statusMessage = ADDRESS_INVALID_MESSAGE
      statusTone = "error"
    }
  }

  const suggestions =
    validation.validationResult?.status === "ambiguous"
      ? validation.validationResult.suggestions ?? []
      : []

  return { statusMessage, statusTone, suggestions }
}
