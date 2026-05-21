export type VercelProjectDomain = {
  name: string;
  verified: boolean;
  projectId?: string;
  apexName?: string;
};

function vercelConfig() {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const rootDomain = process.env.ROOT_DOMAIN?.trim().toLowerCase();
  if (!token || !projectId || !teamId || !rootDomain) return null;
  return { token, projectId, teamId, rootDomain };
}

/** True when Vercel domain registration can run (server env). */
export function isVercelDomainRegistrationConfigured(): boolean {
  return vercelConfig() !== null;
}

/**
 * Registers `{slug}.{ROOT_DOMAIN}` on the Vercel project so Let's Encrypt can issue
 * per-subdomain SSL while DNS stays on Cloudflare (wildcard CNAME → Vercel).
 */
export async function registerTenantDomain(slug: string): Promise<
  | { ok: true; skipped: false; domain: VercelProjectDomain }
  | { ok: true; skipped: true; reason: string }
> {
  const cfg = vercelConfig();
  if (!cfg) {
    return { ok: true, skipped: true, reason: "Vercel env not configured" };
  }

  const host = `${slug.trim().toLowerCase()}.${cfg.rootDomain}`;
  const url = new URL(
    `https://api.vercel.com/v10/projects/${cfg.projectId}/domains`
  );
  url.searchParams.set("teamId", cfg.teamId);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: host }),
  });

  const text = await res.text();
  let payload: { error?: { code?: string; message?: string }; name?: string; verified?: boolean } =
    {};
  try {
    payload = text ? (JSON.parse(text) as typeof payload) : {};
  } catch {
    /* non-JSON body */
  }

  if (res.ok) {
    return {
      ok: true,
      skipped: false,
      domain: {
        name: String(payload.name ?? host),
        verified: Boolean(payload.verified),
        projectId: cfg.projectId,
        apexName: cfg.rootDomain,
      },
    };
  }

  const code = payload.error?.code ?? "";
  const message = payload.error?.message ?? text;
  if (
    res.status === 409 ||
    code === "domain_already_in_use" ||
    /already/i.test(message)
  ) {
    return {
      ok: true,
      skipped: false,
      domain: { name: host, verified: true },
    };
  }

  throw new Error(`Vercel domain registration failed (${res.status}): ${message}`);
}
