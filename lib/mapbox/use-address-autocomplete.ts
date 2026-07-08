"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ADDRESS_AUTOCOMPLETE_EMPTY_MESSAGE,
  ADDRESS_AUTOCOMPLETE_ERROR_MESSAGE,
  shouldRequestAddressAutocomplete,
} from "@/lib/mapbox/address-autocomplete"
import type {
  AddressQueryParts,
  AddressSuggestion,
  ParsedAddressComponents,
} from "@/lib/mapbox/address-validation-types"

type LocalityParts = Pick<AddressQueryParts, "city" | "state" | "zipCode">

type Options = {
  debounceMs?: number
}

export function useAddressAutocomplete(
  address1: string,
  locality: LocalityParts,
  options: Options = {}
) {
  const { debounceMs = 400 } = options
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isAddressVerified, setIsAddressVerified] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const requestIdRef = useRef(0)
  const verifiedAddressRef = useRef("")

  const resetVerification = useCallback(() => {
    setIsAddressVerified(false)
    verifiedAddressRef.current = ""
  }, [])

  const selectSuggestion = useCallback((suggestion: AddressSuggestion) => {
    const street = suggestion.components.address1.trim()
    setIsAddressVerified(true)
    verifiedAddressRef.current = street
    setSuggestions([])
    setSearchError(null)
    setIsOpen(false)
    return suggestion.components
  }, [])

  const closeSuggestions = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openSuggestions = useCallback(() => {
    if (suggestions.length > 0) {
      setIsOpen(true)
    }
  }, [suggestions.length])

  useEffect(() => {
    const trimmed = address1.trim()
    if (!shouldRequestAddressAutocomplete(trimmed)) {
      setSuggestions([])
      setSearchError(null)
      setIsLoading(false)
      setIsOpen(false)
      if (trimmed.length === 0) {
        resetVerification()
      }
      return
    }

    if (isAddressVerified && trimmed === verifiedAddressRef.current) {
      return
    }

    if (isAddressVerified && trimmed !== verifiedAddressRef.current) {
      resetVerification()
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/address/autocomplete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address1: trimmed,
              city: locality.city,
              state: locality.state,
              zipCode: locality.zipCode,
            }),
          })

          if (requestId !== requestIdRef.current) return

          if (!res.ok) {
            setSuggestions([])
            setIsOpen(false)
            setSearchError(ADDRESS_AUTOCOMPLETE_ERROR_MESSAGE)
            return
          }

          const payload = (await res.json()) as { suggestions?: AddressSuggestion[] }
          const nextSuggestions = Array.isArray(payload.suggestions) ? payload.suggestions : []
          setSuggestions(nextSuggestions)
          setIsOpen(nextSuggestions.length > 0)
          setSearchError(
            nextSuggestions.length === 0 ? ADDRESS_AUTOCOMPLETE_EMPTY_MESSAGE : null
          )
        } catch {
          if (requestId !== requestIdRef.current) return
          setSuggestions([])
          setIsOpen(false)
          setSearchError(ADDRESS_AUTOCOMPLETE_ERROR_MESSAGE)
        } finally {
          if (requestId === requestIdRef.current) {
            setIsLoading(false)
          }
        }
      })()
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [address1, locality.city, locality.state, locality.zipCode, debounceMs, isAddressVerified, resetVerification])

  return {
    suggestions,
    isLoading,
    searchError,
    isAddressVerified,
    isOpen,
    selectSuggestion,
    resetVerification,
    closeSuggestions,
    openSuggestions,
  }
}

export type AddressAutocompleteSelection = ParsedAddressComponents
