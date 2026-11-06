/** Next throws this while prerendering a route that reads cookies or headers. It must propagate. */
export function rethrowDynamicServerUsage(error: unknown): void {
  if (!error || typeof error !== "object") return;
  const digest = "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  const message = error instanceof Error ? error.message : "";
  if (digest === "DYNAMIC_SERVER_USAGE" || message.includes("Dynamic server usage")) {
    throw error;
  }
}
