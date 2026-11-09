import { integrationError } from "@/lib/integrations/http";

export const runtime = "nodejs";

/** Inbound APIs intentionally omit list/export endpoints. */
export async function GET() {
  return integrationError(
    400,
    "VALIDATION_ERROR",
    "Listing applicants is not supported. Use GET /api/v1/applicants/search with email or phone."
  );
}
