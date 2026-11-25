/** Server-side fetch with bounded attempts and retries for safe reads only. */
export function createResilientFetch(options?: {
  timeoutMs?: number;
  retries?: number;
}): typeof fetch {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const retries = options?.retries ?? 2;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: unknown;
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const callerSignal = init?.signal ?? request?.signal;
    const canRetry = method === "GET" || method === "HEAD";

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const signal = callerSignal
        ? AbortSignal.any([callerSignal, controller.signal])
        : controller.signal;

      try {
        const response = await fetch(input, {
          ...init,
          signal,
        });
        clearTimeout(timer);
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        const retryable = isRetryableFetchError(error);
        // An interrupted write may already have committed. Never replay it here.
        if (!canRetry || signal.aborted || !retryable || attempt >= retries) {
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
