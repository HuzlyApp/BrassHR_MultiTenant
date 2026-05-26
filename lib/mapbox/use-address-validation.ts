"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { buildAddressQuery, shouldValidateAddressQuery } from "@/lib/mapbox/address-validation"
import type {
  AddressQueryParts,
  AddressSuggestion,
  AddressValidationResult,
} from "@/lib/mapbox/address-validation-types"
import { validationResultFromSuggestion } from "@/lib/mapbox/address-validation"

export type AddressValidationUiState =
  | { phase: "idle" }
  | { phase: "validating" }
  | { phase: "result"; result: AddressValidationResult }

type Options = {
  debounceMs?: number
  /** Run validation immediately when parts first populate (e.g. parsed resume). */
  validateOnMount?: boolean
}

export function useAddressValidation(parts: AddressQueryParts, options: Options = {}) {
  const { debounceMs = 450, validateOnMount = true } = options
  const [uiState, setUiState] = useState<AddressValidationUiState>({ phase: "idle" })
  const [originalParsedAddress, setOriginalParsedAddress] = useState<string | null>(null)
  const mountedRef = useRef(false)
  const requestIdRef = useRef(0)
  const userConfirmedRef = useRef(false)

  const query = buildAddressQuery(parts)

  const runValidation = useCallback(async (addressQuery: string, originalForResult: string) => {
    if (!shouldValidateAddressQuery(addressQuery)) {
      setUiState({ phase: "idle" })
      return
    }

    const requestId = ++requestIdRef.current
    setUiState({ phase: "validating" })

    try {
      const res = await fetch("/api/address/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: addressQuery }),
      })
      if (requestId !== requestIdRef.current) return

      if (!res.ok) {
        setUiState({
          phase: "result",
          result: {
            originalAddress: originalForResult,
            isValid: false,
            status: "invalid",
            confidence: 0,
            source: "mapbox",
          },
        })
        return
      }

      const result = (await res.json()) as AddressValidationResult
      setUiState({ phase: "result", result })
      userConfirmedRef.current = result.isValid && result.status === "valid"
    } catch {
      if (requestId !== requestIdRef.current) return
      setUiState({
        phase: "result",
        result: {
          originalAddress: originalForResult,
          isValid: false,
          status: "invalid",
          confidence: 0,
          source: "mapbox",
        },
      })
    }
  }, [])

  const confirmSuggestion = useCallback(
    (suggestion: AddressSuggestion) => {
      const original = originalParsedAddress ?? query
      const result = validationResultFromSuggestion(original, suggestion)
      userConfirmedRef.current = true
      setUiState({ phase: "result", result })
      return { result, components: suggestion.components }
    },
    [originalParsedAddress, query]
  )

  const resetUserConfirmation = useCallback(() => {
    userConfirmedRef.current = false
  }, [])

  /** Capture the first parsed address string for storage alongside Mapbox normalization. */
  const captureOriginalParsedAddress = useCallback((value: string) => {
    const t = value.trim()
    if (t) setOriginalParsedAddress(t)
  }, [])

  useEffect(() => {
    if (!shouldValidateAddressQuery(query)) {
      setUiState({ phase: "idle" })
      return
    }

    if (userConfirmedRef.current) {
      return
    }

    const originalForResult = originalParsedAddress ?? query
    const delay = !mountedRef.current && validateOnMount ? 0 : debounceMs
    mountedRef.current = true

    const timer = window.setTimeout(() => {
      void runValidation(query, originalForResult)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [query, debounceMs, validateOnMount, runValidation, originalParsedAddress])

  const validationResult =
    uiState.phase === "result" ? uiState.result : null
  const isValidating = uiState.phase === "validating"
  const isAddressVerified = Boolean(validationResult?.isValid)

  return {
    query,
    uiState,
    validationResult,
    isValidating,
    isAddressVerified,
    originalParsedAddress,
    captureOriginalParsedAddress,
    confirmSuggestion,
    resetUserConfirmation,
    revalidateNow: () => {
      userConfirmedRef.current = false
      void runValidation(query, originalParsedAddress ?? query)
    },
  }
}
