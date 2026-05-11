"use client"

export default function AutosaveStatus({
  state,
}: {
  state: "idle" | "saving" | "saved" | "offline"
}) {
  if (state === "idle") return null
  const text =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Offline — will sync when online"
  return (
    <span
      className="pointer-events-none text-[11px] font-medium text-slate-500 transition-opacity"
      aria-live="polite"
    >
      {text}
    </span>
  )
}
