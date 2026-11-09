import { NextResponse } from "next/server";

export type IntegrationErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

export type IntegrationErrorDetail = {
  field?: string;
  message: string;
};

export function integrationError(
  status: number,
  code: IntegrationErrorCode,
  message: string,
  details: IntegrationErrorDetail[] = [],
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status, headers }
  );
}

export function integrationRateLimited(retryAfterSec: number): NextResponse {
  return integrationError(
    429,
    "RATE_LIMITED",
    "Too many requests. Retry after the period indicated by Retry-After.",
    [],
    {
      "Retry-After": String(Math.max(1, retryAfterSec)),
    }
  );
}
