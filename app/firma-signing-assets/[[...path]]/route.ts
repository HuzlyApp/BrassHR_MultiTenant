import { NextRequest, NextResponse } from "next/server";
import { getFirmaSigningAppUrl } from "@/lib/firma/signing-branding-proxy";

export const runtime = "nodejs";

/** Proxies Firma `/assets/*` for same-origin signing embed (avoids cross-origin module CORS failures). */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  const { path = [] } = await context.params;
  const firmaApp = getFirmaSigningAppUrl();
  const targetUrl = new URL(`${firmaApp}/assets/${path.join("/")}`);
  targetUrl.search = req.nextUrl.search;

  const upstream = await fetch(targetUrl.toString(), {
    headers: {
      Accept: req.headers.get("accept") ?? "*/*",
    },
    redirect: "follow",
    cache: "force-cache",
  });

  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.set("Cache-Control", "public, max-age=86400");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
