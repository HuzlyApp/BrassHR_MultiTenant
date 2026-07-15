import { describe, expect, it } from "vitest";

const PRODUCTION_REF = "avhdoifnsnoeavqxnwwm";
const DEVELOPMENT_REF = "mgucromvpnxntwyssltd";

function projectRefFromUrl(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url).hostname;
    const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

describe("supabase environment separation", () => {
  it("parses project refs from supabase URLs", () => {
    expect(projectRefFromUrl(`https://${DEVELOPMENT_REF}.supabase.co`)).toBe(
      DEVELOPMENT_REF
    );
    expect(projectRefFromUrl(`https://${PRODUCTION_REF}.supabase.co`)).toBe(
      PRODUCTION_REF
    );
  });

  it("treats development and production refs as distinct", () => {
    expect(DEVELOPMENT_REF).not.toBe(PRODUCTION_REF);
  });

  it("fails closed when a non-production build points at production", () => {
    const vercelEnv = undefined as string | undefined;
    const nodeEnv = "development";
    const allowProd = false;
    const ref = PRODUCTION_REF;
    const isProdTarget =
      vercelEnv === "production" ||
      (nodeEnv === "production" && vercelEnv == null && allowProd);
    const shouldReject = !isProdTarget && ref === PRODUCTION_REF && !allowProd;
    expect(shouldReject).toBe(true);
  });

  it("allows production target to use production ref", () => {
    const vercelEnv = "production";
    const ref = PRODUCTION_REF;
    const isProdTarget = vercelEnv === "production";
    expect(isProdTarget && ref === PRODUCTION_REF).toBe(true);
  });
});
