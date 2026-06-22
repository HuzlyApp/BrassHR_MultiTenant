export type SafeFetchJsonResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; isHtml: boolean; data?: T };

/**
 * Fetches JSON with defensive parsing — avoids "Unexpected token '<'" when the server returns HTML error pages.
 */
export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "Network request failed",
      isHtml: false,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!text.trim()) {
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Request failed (${res.status})`, isHtml: false };
    }
    return { ok: false, status: res.status, error: "Empty response body", isHtml: false };
  }

  const looksLikeHtml =
    contentType.includes("text/html") ||
    text.trimStart().startsWith("<!DOCTYPE") ||
    text.trimStart().startsWith("<html");

  if (looksLikeHtml) {
    return {
      ok: false,
      status: res.status,
      error:
        res.status === 404
          ? "API route not found. Restart the dev server if you recently changed routes."
          : `Server returned HTML instead of JSON (${res.status})`,
      isHtml: true,
    };
  }

  try {
    const data = JSON.parse(text) as T;
    if (!res.ok) {
      const errPayload = data as { error?: string; detail?: string };
      return {
        ok: false,
        status: res.status,
        error: errPayload.detail ?? errPayload.error ?? `Request failed (${res.status})`,
        isHtml: false,
        data,
      };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: "Response was not valid JSON",
      isHtml: looksLikeHtml,
    };
  }
}
