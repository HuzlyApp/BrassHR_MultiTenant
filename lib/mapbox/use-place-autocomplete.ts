"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  PLACE_AUTOCOMPLETE_EMPTY_MESSAGE,
  PLACE_AUTOCOMPLETE_ERROR_MESSAGE,
  shouldRequestPlaceAutocomplete,
  type PlaceSuggestion,
} from "@/lib/mapbox/place-autocomplete"

type Options = {
  debounceMs?: number
}

/**
 * Mapbox place autocomplete for job locations (city / area / address).
 * Uses `/api/address/places` so the access token stays server-side.
 */
export function usePlaceAutocomplete(query: string, options: Options = {}) {
  const { debounceMs = 350 } = options
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const requestIdRef = useRef(0)
  const verifiedQueryRef = useRef("")

  const resetVerification = useCallback(() => {
    setIsVerified(false)
    verifiedQueryRef.current = ""
  }, [])

  const selectSuggestion = useCallback((suggestion: PlaceSuggestion) => {
    setIsVerified(true)
    verifiedQueryRef.current = suggestion.placeName
    setSuggestions([])
    setSearchError(null)
    setIsOpen(false)
    return suggestion
  }, [])

  const closeSuggestions = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openSuggestions = useCallback(() => {
    if (suggestions.length > 0) setIsOpen(true)
  }, [suggestions.length])

  useEffect(() => {
    const trimmed = query.trim()
    if (!shouldRequestPlaceAutocomplete(trimmed)) {
      setSuggestions([])
      setSearchError(null)
      setIsLoading(false)
      setIsOpen(false)
      if (trimmed.length === 0) resetVerification()
      return
    }

    if (isVerified && trimmed === verifiedQueryRef.current) return

    if (isVerified && trimmed !== verifiedQueryRef.current) {
      resetVerification()
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/address/places", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed }),
          })

          if (requestId !== requestIdRef.current) return

          if (!res.ok) {
            setSuggestions([])
            setIsOpen(false)
            setSearchError(PLACE_AUTOCOMPLETE_ERROR_MESSAGE)
            return
          }

          const payload = (await res.json()) as { suggestions?: PlaceSuggestion[] }
          const next = Array.isArray(payload.suggestions) ? payload.suggestions : []
          setSuggestions(next)
          setIsOpen(next.length > 0)
          setSearchError(next.length === 0 ? PLACE_AUTOCOMPLETE_EMPTY_MESSAGE : null)
        } catch {
          if (requestId !== requestIdRef.current) return
          setSuggestions([])
          setIsOpen(false)
          setSearchError(PLACE_AUTOCOMPLETE_ERROR_MESSAGE)
        } finally {
          if (requestId === requestIdRef.current) setIsLoading(false)
        }
      })()
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [query, debounceMs, isVerified, resetVerification])

  return {
    suggestions,
    isLoading,
    searchError,
    isOpen,
    isVerified,
    selectSuggestion,
    closeSuggestions,
    openSuggestions,
    resetVerification,
  }
}
