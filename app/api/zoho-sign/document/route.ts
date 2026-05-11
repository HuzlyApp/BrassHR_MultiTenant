import { NextRequest, NextResponse } from "next/server";
import {
  fetchZohoSignAccessToken,
  findZohoSignApiBaseForRequest,
} from "@/lib/zoho-sign-server";

export const runtime = "nodejs";

function pdfPaths(requestId: string, documentId: string | null): string[] {
  const rid = encodeURIComponent(requestId);
  if (documentId?.trim()) {
    const did = encodeURIComponent(documentId.trim());
    return [
      `/api/v1/requests/${rid}/documents/${did}/pdf`,
      `/api/v1/requests/${rid}/pdf`,
    ];
  }
  return [`/api/v1/requests/${rid}/pdf`];
}

function responseLooksLikePdfBinary(res: Response): boolean {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  return (
    ct.includes("application/pdf") ||
    ct.includes("application/octet-stream") ||
    ct.includes("application/zip")
  );
}

export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("request_id")?.trim() || "";
    const documentId = req.nextUrl.searchParams.get("document_id")?.trim() || "";
    const specificDownload =
      req.nextUrl.searchParams.get("specific") === "1" ||
      req.nextUrl.searchParams.get("specific") === "true";
    const mode = (req.nextUrl.searchParams.get("mode") || "preview").toLowerCase();

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Missing request_id query parameter" },
        { status: 400 },
      );
    }
    if (specificDownload && !documentId) {
      return NextResponse.json(
        { success: false, error: "Missing document_id query parameter for specific document download" },
        { status: 400 },
      );
    }

    const accessToken = await fetchZohoSignAccessToken();
    const resolved = await findZohoSignApiBaseForRequest(accessToken, requestId);

    if (!resolved.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not resolve Zoho Sign request (wrong data center or invalid request id)",
          details: {
            hint:
              "Set ZOHO_SIGN_API_BASE (e.g. https://sign.zoho.eu) and ZOHO_ACCOUNTS_HOST to the same Zoho data center as the org that created this request. One OAuth token only works on the matching Sign host; wrong host returns 9041.",
            resolve_attempts: resolved.attempts,
          },
        },
        { status: 502 },
      );
    }

    const signBase = resolved.base;
    const paths = pdfPaths(requestId, documentId || null);

    let pdfBuffer: Buffer | null = null;
    const attempts: Array<{
      base: string;
      path: string;
      status: number;
      content_type: string | null;
      body_preview: string;
    }> = [];

    for (const path of paths) {
      const res = await fetch(`${signBase}${path}`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });

      const contentType = res.headers.get("content-type");
      const buf = Buffer.from(await res.arrayBuffer());
      const isPdfMagic = buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
      const isZipMagic = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b; // PK — multi-doc bundle

      if (res.ok && (responseLooksLikePdfBinary(res) || isPdfMagic || isZipMagic)) {
        pdfBuffer = buf;
        break;
      }

      const bodyText = buf.toString("utf8");
      attempts.push({
        base: signBase,
        path,
        status: res.status,
        content_type: contentType,
        body_preview: bodyText.replace(/\s+/g, " ").slice(0, 240),
      });
    }

    if (!pdfBuffer) {
      const preferred =
        attempts.find((a) => a.status !== 404 || !/<!doctype/i.test(a.body_preview)) ??
        attempts[attempts.length - 1];
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch Zoho document PDF",
          details: preferred
            ? {
                base: preferred.base,
                path: preferred.path,
                status: preferred.status,
                content_type: preferred.content_type,
                body: preferred.body_preview,
                hint:
                  "The request may be incomplete, document_id may be invalid, or the OAuth token may be unauthorized for this Zoho Sign data center.",
              }
            : { message: "No PDF paths attempted" },
          attempts,
          resolved_base: signBase,
        },
        { status: 502 },
      );
    }

    const isZip = pdfBuffer.length >= 4 && pdfBuffer[0] === 0x50 && pdfBuffer[1] === 0x4b;
    const fileName = isZip
      ? `onboarding-agreement-${requestId}.zip`
      : `onboarding-agreement-${requestId}.pdf`;
    const disposition =
      mode === "download"
        ? `attachment; filename="${fileName}"`
        : `inline; filename="${fileName}"`;

    const outContentType = isZip ? "application/zip" : "application/pdf";

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": outContentType,
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected document route error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
