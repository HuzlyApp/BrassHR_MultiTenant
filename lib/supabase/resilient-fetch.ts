        /** Server-side fetch with longer timeout, light retry, and optional Supabase fallback. */
export function createResilientFetch(options?: {
  timeoutMs?: number;
  retries?: number;
  onPrimaryFailure?: () => void;
  resolveUrl?: () => string | undefined;
  resolveAnonKey?: () => string | undefined;
}): typeof fetch {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const retries = options?.retries ?? 2;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: unknown;
    let usedFallback = false;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let requestInput = input;
        if (usedFallback && options?.resolveUrl) {
          const fallbackUrl = options.resolveUrl();
          if (fallbackUrl && typeof input === "string") {
            requestInput = rewriteSupabaseRequestUrl(input, fallbackUrl);
          } else if (fallbackUrl && input instanceof URL) {
            requestInput = new URL(rewriteSupabaseRequestUrl(input.toString(), fallbackUrl));
          } else if (fallbackUrl && input instanceof Request) {
            requestInput = new Request(rewriteSupabaseRequestUrl(input.url, fallbackUrl), input);
          }

          const fallbackKey = options.resolveAnonKey?.();
          if (fallbackKey && init?.headers) {
            const headers = new Headers(init.headers);
            headers.set("apikey", fallbackKey);
            headers.set("Authorization", `Bearer ${fallbackKey}`);
            init = { ...init, headers };
          }
        }

        const response = await fetch(requestInput, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!usedFallback && shouldFailoverResponse(response)) {
          options?.onPrimaryFailure?.();
          usedFallback = true;
          if (attempt < retries) continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        const retryable = isRetryableFetchError(error);
        if (!usedFallback && retryable) {
          options?.onPrimaryFailure?.();
          usedFallback = true;
          if (attempt < retries) continue;
        }
        if (!retryable || attempt >= retries) {
          throw error;
        }
        await sleep(400 * (attempt + 1));
      }
    }

    throw lastError;
  };
}

function shouldFailoverResponse(response: Response): boolean {
  return response.status === 522 || response.status === 523 || response.status === 524 || response.status >= 500;
}

function rewriteSupabaseRequestUrl(original: string, nextBaseUrl: string): string {
  try {
    const current = new URL(original);
    const base = new URL(nextBaseUrl);
    current.protocol = base.protocol;
    current.host = base.host;
    return current.toString();
  } catch {
    return original;
  }
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
    normalized.includes("abort") ||
    normalized.includes("network") ||
    normalized.includes("connection terminated")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
