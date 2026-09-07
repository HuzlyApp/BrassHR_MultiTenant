import { afterEach, describe, expect, it } from "vitest";
import {
  isAllowedAppOrigin,
  migrateLegacyAppOrigin,
  resolveAppOrigin,
  resolveApplicantEmailAppOrigin,
  resolvePlatformAppOrigin,
} from "@/lib/resolve-app-origin";

describe("isAllowedAppOrigin", () => {
  const prevRoot = process.env.ROOT_DOMAIN;
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.ROOT_DOMAIN;
    else process.env.ROOT_DOMAIN = prevRoot;
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it("allows localhost and brasshr root hosts", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(isAllowedAppOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedAppOrigin("https://brasshr.com")).toBe(true);
    expect(isAllowedAppOrigin("https://jobs.brasshr.com")).toBe(true);
  });

  it("allows Vercel deployment hosts used by staging/devmode", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(isAllowedAppOrigin("https://brasshr-devmode.vercel.app")).toBe(true);
    expect(isAllowedAppOrigin("https://brasshr-git-staging.vercel.app")).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(isAllowedAppOrigin("https://evil.example.com")).toBe(false);
  });
});

describe("migrateLegacyAppOrigin", () => {
  const prevRoot = process.env.ROOT_DOMAIN;

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.ROOT_DOMAIN;
    else process.env.ROOT_DOMAIN = prevRoot;
  });

  it("rewrites hr.nexusmedpro.com to brasshr.com apex", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(migrateLegacyAppOrigin("https://hr.nexusmedpro.com")).toBe("https://brasshr.com");
  });

  it("rewrites tenant.nexusmedpro.com to tenant.brasshr.com", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(migrateLegacyAppOrigin("https://test.nexusmedpro.com")).toBe("https://test.brasshr.com");
  });

  it("rewrites bare nexusmedpro.com to brasshr.com", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(migrateLegacyAppOrigin("https://nexusmedpro.com")).toBe("https://brasshr.com");
  });

  it("leaves non-legacy hosts unchanged", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(migrateLegacyAppOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(migrateLegacyAppOrigin("https://brasshr.com")).toBe("https://brasshr.com");
    expect(migrateLegacyAppOrigin("https://zipstaff.brasshr.com")).toBe(
      "https://zipstaff.brasshr.com"
    );
  });
});

describe("resolveAppOrigin", () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const prevRoot = process.env.ROOT_DOMAIN;

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    if (prevRoot === undefined) delete process.env.ROOT_DOMAIN;
    else process.env.ROOT_DOMAIN = prevRoot;
  });

  it("migrates legacy NEXT_PUBLIC_APP_URL to brasshr.com apex", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://hr.nexusmedpro.com";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolveAppOrigin({ headers: new Headers() });
    expect(origin).toBe("https://brasshr.com");
  });

  it("collapses mistaken hr.brasshr.com env value to apex", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://hr.brasshr.com";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolveAppOrigin({ headers: new Headers() });
    expect(origin).toBe("https://brasshr.com");
  });
});

describe("resolvePlatformAppOrigin", () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const prevRoot = process.env.ROOT_DOMAIN;

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    if (prevRoot === undefined) delete process.env.ROOT_DOMAIN;
    else process.env.ROOT_DOMAIN = prevRoot;
  });

  it("returns brasshr.com apex for owner signup emails", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://hr.nexusmedpro.com";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolvePlatformAppOrigin({ headers: new Headers() });
    expect(origin).toBe("https://brasshr.com");
  });

  it("keeps localhost for local development", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolvePlatformAppOrigin({
      headers: new Headers({ host: "localhost:3000" }),
    });
    expect(origin).toBe("http://localhost:3000");
  });

  it("keeps Vercel preview / devmode app hosts", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://brasshr-devmode.vercel.app";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolvePlatformAppOrigin({ headers: new Headers() });
    expect(origin).toBe("https://brasshr-devmode.vercel.app");
  });

  it("prefers vercel request host over production NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://brasshr.com";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolvePlatformAppOrigin({
      headers: new Headers({
        host: "brasshr-devmode.vercel.app",
        "x-forwarded-proto": "https",
      }),
    });
    expect(origin).toBe("https://brasshr-devmode.vercel.app");
  });

  it("collapses tenant vanity hosts to marketing apex", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolvePlatformAppOrigin({
      headers: new Headers({ host: "jobs.brasshr.com", "x-forwarded-proto": "https" }),
    });
    expect(origin).toBe("https://brasshr.com");
  });
});

describe("resolveApplicantEmailAppOrigin", () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const prevRoot = process.env.ROOT_DOMAIN;

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    if (prevRoot === undefined) delete process.env.ROOT_DOMAIN;
    else process.env.ROOT_DOMAIN = prevRoot;
  });

  it("prefers localhost request host over production NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://remote.brasshr.com";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolveApplicantEmailAppOrigin({
      headers: new Headers({ host: "localhost:3000" }),
    });
    expect(origin).toBe("http://localhost:3000");
  });

  it("prefers Vercel devmode request host over production NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://remote.brasshr.com";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolveApplicantEmailAppOrigin({
      headers: new Headers({
        host: "brasshr-devmode.vercel.app",
        "x-forwarded-proto": "https",
      }),
    });
    expect(origin).toBe("https://brasshr-devmode.vercel.app");
  });

  it("uses client origin when provided", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://remote.brasshr.com";
    process.env.ROOT_DOMAIN = "brasshr.com";

    const origin = resolveApplicantEmailAppOrigin(
      { headers: new Headers({ host: "remote.brasshr.com", "x-forwarded-proto": "https" }) },
      "http://localhost:3000"
    );
    expect(origin).toBe("http://localhost:3000");
  });
});
