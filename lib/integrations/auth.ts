import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  touchApiKeyLastUsed,
  verifyInboundApiKey,
  type VerifiedTenantApiKey,
} from "@/lib/integrations/api-keys";
import { integrationError, integrationRateLimited } from "@/lib/integrations/http";
import { enforceRateLimit, envRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type InboundApiAuthContext = {
  tenantId: string;
  apiKeyId: string;
  apiKeyPrefix: string;
  scopes: string[];
  createdByUserId: string | null;
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>;
  key: VerifiedTenantApiKey;
};

function extractApiKey(req: NextRequest): string | null {
  const xApiKey = req.headers.get("x-api-key")?.trim();
  if (xApiKey) return xApiKey;

  const auth = req.headers.get("authorization")?.trim();
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1]?.trim() || null;
}

async function auditAuthFailure(
  req: NextRequest,
  action: string,
  metadata: Record<string, unknown>
): Promise<void> {
  void writeActivityLog({
    actorUserId: null,
    action,
    entityType: "tenant_api_key",
    tenantId: typeof metadata.tenant_id === "string" ? metadata.tenant_id : null,
    metadata,
    request: req,
  });
}

/**
 * Authenticate an inbound Integration API request.
 * Supports Authorization: Bearer <key> or X-API-Key: <key>.
 * Optional X-Tenant-Id must match the key's tenant when supplied.
 */
export async function requireInboundApiAuth(
  req: NextRequest,
  options: { kind: "write" | "search" }
): Promise<InboundApiAuthContext | NextResponse> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return integrationError(500, "INTERNAL", "Service unavailable");
  }

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    await auditAuthFailure(req, "inbound_api.unauthorized", {
      reason: "missing_api_key",
      path: req.nextUrl.pathname,
    });
    return integrationError(401, "UNAUTHORIZED", "Missing or invalid API key");
  }

  let verified: VerifiedTenantApiKey | null = null;
  try {
    verified = await verifyInboundApiKey(supabase, apiKey);
  } catch (error) {
    console.error("[inbound-api] key verification failed", error);
    return integrationError(500, "INTERNAL", "Service unavailable");
  }

  if (!verified) {
    await auditAuthFailure(req, "inbound_api.unauthorized", {
      reason: "invalid_api_key",
      path: req.nextUrl.pathname,
    });
    return integrationError(401, "UNAUTHORIZED", "Missing or invalid API key");
  }

  const explicitTenant = req.headers.get("x-tenant-id")?.trim();
  if (explicitTenant && explicitTenant !== verified.tenantId) {
    await auditAuthFailure(req, "inbound_api.forbidden", {
      reason: "tenant_mismatch",
      tenant_id: verified.tenantId,
      requested_tenant_id: explicitTenant,
      api_key_id: verified.id,
      path: req.nextUrl.pathname,
    });
    return integrationError(403, "FORBIDDEN", "API key is not authorized for this tenant");
  }

  if (!verified.scopes.includes("inbound") && !verified.scopes.includes("*")) {
    await auditAuthFailure(req, "inbound_api.forbidden", {
      reason: "scope_denied",
      tenant_id: verified.tenantId,
      api_key_id: verified.id,
      scopes: verified.scopes,
      path: req.nextUrl.pathname,
    });
    return integrationError(403, "FORBIDDEN", "API key is not authorized for this action");
  }

  const writeLimit = envRateLimit("RATE_LIMIT_INBOUND_API_WRITE_PER_MIN", 60);
  const searchLimit = envRateLimit("RATE_LIMIT_INBOUND_API_SEARCH_PER_MIN", 120);
  const limited = await enforceRateLimit(req, {
    namespace: `inbound-api.${options.kind}`,
    key: verified.id,
    limit: options.kind === "write" ? writeLimit : searchLimit,
    windowMs: 60 * 1000,
  });
  if (limited) {
    const retryAfterSec = Number(limited.headers.get("Retry-After") ?? 60);
    await auditAuthFailure(req, "inbound_api.rate_limited", {
      tenant_id: verified.tenantId,
      api_key_id: verified.id,
      kind: options.kind,
      path: req.nextUrl.pathname,
    });
    return integrationRateLimited(
      Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 60
    );
  }

  void touchApiKeyLastUsed(supabase, verified.id);

  return {
    tenantId: verified.tenantId,
    apiKeyId: verified.id,
    apiKeyPrefix: verified.keyPrefix,
    scopes: verified.scopes,
    createdByUserId: verified.createdByUserId,
    supabase,
    key: verified,
  };
}

export function auditInboundApiCall(input: {
  req: NextRequest;
  auth: InboundApiAuthContext;
  action: string;
  entityType: string;
  entityId?: string | null;
  outcome: "success" | "failure";
  metadata?: Record<string, unknown>;
}): void {
  void writeActivityLog({
    actorUserId: input.auth.createdByUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    tenantId: input.auth.tenantId,
    metadata: {
      ...(input.metadata ?? {}),
      outcome: input.outcome,
      api_key_id: input.auth.apiKeyId,
      api_key_prefix: input.auth.apiKeyPrefix,
      path: input.req.nextUrl.pathname,
      method: input.req.method,
    },
    request: input.req,
  });
}
