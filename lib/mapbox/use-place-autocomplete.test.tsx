/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePlaceAutocomplete } from "./use-place-autocomplete"

const suggestion = { id: "place.1", placeName: "Dallas, Texas", displayLabel: "Dallas, Texas", zipCode: null }
async function tick(ms = 350) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

describe("place autocomplete request lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn()) })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

  it("aborts superseded searches and ignores a late response after clearing", async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(() => new Promise(r => { resolve = r }))
    const { result, rerender } = renderHook(({ query }) => usePlaceAutocomplete(query), { initialProps: { query: "Dallas" } })
    act(() => result.current.openSuggestions())
    await tick()
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!
    rerender({ query: "" })
    expect(signal.aborted).toBe(true)
    await act(async () => resolve(new Response(JSON.stringify({ suggestions: [suggestion] }))))
    expect(result.current.suggestions).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isOpen).toBe(false)
  })

  it("does not reopen suggestions when a response arrives after blur", async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(() => new Promise(r => { resolve = r }))
    const { result } = renderHook(() => usePlaceAutocomplete("Dallas"))
    act(() => result.current.openSuggestions())
    await tick()
    act(() => result.current.closeSuggestions())
    await act(async () => resolve(new Response(JSON.stringify({ suggestions: [suggestion] }))))
    expect(result.current.suggestions).toHaveLength(1)
    expect(result.current.isOpen).toBe(false)
  })

  it("ends a stalled search with a recoverable error after six seconds", async () => {
    vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    }))
    const { result } = renderHook(() => usePlaceAutocomplete("Dallas"))
    await tick(6000)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.searchError).toBeTruthy()
  })
})
