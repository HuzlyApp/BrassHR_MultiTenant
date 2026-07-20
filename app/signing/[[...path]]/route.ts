import { NextRequest, NextResponse } from "next/server";
import {
  getFirmaSigningAppUrl,
  rewriteFirmaSigningProxyHtml,
} from "@/lib/firma/signing-branding-proxy";

export const runtime = "nodejs";

/**
 * Same-origin proxy for Firma recipient signing pages.
 * Injects a fetch patch so get-signing-view-data returns BrassHR gold instead of legacy teal.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  const { path = [] } = await context.params;
  const firmaApp = getFirmaSigningAppUrl();
  const targetPath = ["signing", ...path].join("/");
  const targetUrl = new URL(`${firmaApp}/${targetPath}`);
  targetUrl.search = req.nextUrl.search;

  const upstream = await fetch(targetUrl.toString(), {
    headers: {
      Accept: req.headers.get("accept") ?? "*/*",
      "Accept-Language": req.headers.get("accept-language") ?? "en",
    },
    redirect: "follow",
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    const html = await upstream.text();
    const body = rewriteFirmaSigningProxyHtml(html);
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.set("Cache-Control", "public, max-age=3600");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
