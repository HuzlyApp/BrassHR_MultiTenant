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
  const focusedRef = useRef(false)
  /** Must match the value written into the input after select (display label), not full place_name. */
  const verifiedQueryRef = useRef("")

  const resetVerification = useCallback(() => {
    setIsVerified(false)
    verifiedQueryRef.current = ""
  }, [])

  const selectSuggestion = useCallback(
    (suggestion: PlaceSuggestion, committedValue?: string) => {
      const committed = (
        committedValue ??
        suggestion.displayLabel ??
        suggestion.placeName
      ).trim()
      setIsVerified(true)
      ++requestIdRef.current
      setIsLoading(false)
      verifiedQueryRef.current = committed
      setSuggestions([])
      setSearchError(null)
      setIsOpen(false)
      return suggestion
    },
    []
  )

  const closeSuggestions = useCallback(() => {
    focusedRef.current = false
    setIsOpen(false)
  }, [])

  const openSuggestions = useCallback(() => {
    focusedRef.current = true
    if (suggestions.length > 0) setIsOpen(true)
  }, [suggestions.length])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const trimmed = query.trim()
    if (!shouldRequestPlaceAutocomplete(trimmed)) {
      setSuggestions([])
      setSearchError(null)
      setIsLoading(false)
      setIsOpen(false)
      if (trimmed.length === 0) resetVerification()
      return
    }

    // Skip re-search when the input matches what the user just selected.
    if (trimmed === verifiedQueryRef.current) {
      setIsOpen(false)
      setSuggestions([])
      setIsLoading(false)
      return
    }

    if (isVerified && trimmed !== verifiedQueryRef.current) {
      resetVerification()
    }

    const controller = new AbortController()
    setSuggestions([])
    setIsOpen(false)
    setIsLoading(true)
    setSearchError(null)

    const deadline = window.setTimeout(() => {
      if (requestId !== requestIdRef.current) return
      ++requestIdRef.current
      controller.abort()
      setIsLoading(false)
      setSuggestions([])
      setIsOpen(false)
      setSearchError(PLACE_AUTOCOMPLETE_ERROR_MESSAGE)
    }, 6000)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/address/places", {
            method: "POST",
            signal: controller.signal,
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
          if (requestId !== requestIdRef.current) return
          const next = Array.isArray(payload.suggestions) ? payload.suggestions : []
          setSuggestions(next)
          setIsOpen(focusedRef.current && next.length > 0)
          setSearchError(next.length === 0 ? PLACE_AUTOCOMPLETE_EMPTY_MESSAGE : null)
        } catch {
          if (requestId !== requestIdRef.current) return
          setSuggestions([])
          setIsOpen(false)
          setSearchError(PLACE_AUTOCOMPLETE_ERROR_MESSAGE)
        } finally {
          window.clearTimeout(deadline)
          if (requestId === requestIdRef.current) setIsLoading(false)
        }
      })()
    }, debounceMs)

    return () => {
      ++requestIdRef.current
      window.clearTimeout(timer)
      window.clearTimeout(deadline)
      controller.abort()
    }
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
