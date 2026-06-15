        /** Server-side fetch with longer timeout and light retry for Supabase REST calls. */
export function createResilientFetch(options?: {
  timeoutMs?: number;
  retries?: number;
}): typeof fetch {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const retries = options?.retries ?? 2;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        const retryable = isRetryableFetchError(error);
        if (!retryable || attempt >= retries) {
          throw error;
        }
        await sleep(400 * (attempt + 1));
      }
    }

    throw lastError;
  };
}

function isRetryableFetchError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
      : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("connect timeout") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("abort")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
