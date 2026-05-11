"use client"

import { useEffect } from "react"

/**
 * Loaded in the signing iframe after Zoho Sign redirects here; notifies the parent step-4 page.
 */
export default function ZohoSignCallbackPage() {
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: "zoho-sign", event: "signing_complete" }, origin)
      }
    } catch {
      /* ignore cross-origin edge cases */
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-gray-700 text-sm p-6">
      Closing signing session… You can return to the application tab.
    </div>
  )
}

