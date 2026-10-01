import type { TenantBranding } from "@/lib/tenant/tenant-branding";

export type TenantBrandingPayload = {
  branding?: TenantBranding;
  tenantFound?: boolean;
  error?: string;
};

const inflight = new Map<string, Promise<TenantBrandingPayload>>();

/** One in-flight request per branding URL, shared by the homepage and the root provider. */
export function fetchTenantBranding(url: string): Promise<TenantBrandingPayload> {
  const existing = inflight.get(url);
  if (existing) return existing;

  const pending = fetch(url, { signal: AbortSignal.timeout(12_000) })
    .then(async (res) => {
      const payload = (await res.json().catch(() => ({}))) as TenantBrandingPayload;
      if (!res.ok) {
        throw new Error(payload.error || "Tenant branding lookup failed");
      }
      return payload;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, pending);
  return pending;
}
