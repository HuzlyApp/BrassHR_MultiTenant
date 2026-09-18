import type { NextConfig } from "next";
import { LEGACY_APPLICATION_ROUTE_REDIRECTS } from "./lib/onboarding/application-routes";

function getSupabaseImageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
    {
      protocol: "https",
      hostname: "**.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
    {
      protocol: "https",
      hostname: "**.supabase.co",
      pathname: "/storage/v1/object/sign/**",
    },
  ];

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  if (supabaseUrl) {
    try {
      const hostname = new URL(supabaseUrl).hostname;
      if (hostname) {
        patterns.unshift({
          protocol: "https",
          hostname,
          pathname: "/storage/v1/object/**",
        });
      }
    } catch {
      /* ignore invalid URL */
    }
  }

  return patterns;
}

const legacyOnboardingRedirects = [
  ...LEGACY_APPLICATION_ROUTE_REDIRECTS.map(({ source, destination }) => ({
    source,
    destination,
    permanent: true,
  })),
  {
    source: "/application/step-3-quiz/:slug",
    destination: "/application/skill-quiz/:slug",
    permanent: true,
  },
  {
    source: "/application/step-3-assessment/:category",
    destination: "/application/skill-assessment/:category",
    permanent: true,
  },
  {
    source: "/application/onboarding/:stepKey",
    destination: "/application/custom-step/:stepKey",
    permanent: true,
  },
];

/** CSP frame-ancestors for the public jobs board (WordPress / third-party iframes). */
function getPublicJobsFrameAncestors(): string {
  const raw = process.env.PUBLIC_JOBS_FRAME_ANCESTORS?.trim();
  if (!raw) return "*";
  return raw
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function buildAppContentSecurityPolicy(frameAncestors: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Firma embed loads pdf.js via data:/blob: workers and Google Fonts for field labels.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://api.firma.dev https://app.firma.dev",
    "worker-src 'self' blob: data: https://api.firma.dev https://app.firma.dev",
    "connect-src 'self' https: wss: blob:",
    "frame-src 'self' https://app.firma.dev https://api.firma.dev",
  ].join("; ");
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getSupabaseImageRemotePatterns(),
  },
  async redirects() {
    return legacyOnboardingRedirects;
  },
  async headers() {
    const baseSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
    ];
    const securityHeaders = [
      ...baseSecurityHeaders,
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Content-Security-Policy",
        value: buildAppContentSecurityPolicy("'self'"),
      },
    ];
    // Public jobs board must be embeddable (WordPress, iframe testers). Do not send
    // X-Frame-Options here — SAMEORIGIN would still block cross-origin parents.
    const publicJobsEmbedHeaders = [
      ...baseSecurityHeaders,
      {
        key: "Content-Security-Policy",
        value: buildAppContentSecurityPolicy(getPublicJobsFrameAncestors()),
      },
    ];
    return [
      {
        source: "/api/tenant-branding",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Vary", value: "Host" },
        ],
      },
      {
        source: "/signing/:path*",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Content-Security-Policy"),
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com https://fonts.cdnfonts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://www.googletagmanager.com https://www.google-analytics.com",
              "worker-src 'self' blob: data:",
              "connect-src 'self' https: wss: blob:",
              "frame-src 'self' https:",
            ].join("; "),
          },
        ],
      },
      {
        source: "/jobs",
        headers: publicJobsEmbedHeaders,
      },
      {
        source: "/jobs/:path*",
        headers: publicJobsEmbedHeaders,
      },
      {
        // Exclude /jobs so SAMEORIGIN / frame-ancestors 'self' do not merge onto embed routes.
        source: "/:path((?!jobs(?:/.*)?$).*)",
        headers: securityHeaders,
      },
    ];
  },
  // Mirror Expo-style vars so the browser bundle gets Supabase URL/anon key (Next only inlines NEXT_PUBLIC_*).
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_PLATFORM_ENFORCE:
      process.env.NEXT_PUBLIC_PLATFORM_ENFORCE ?? process.env.PLATFORM_ENFORCE ?? "",
    NEXT_PUBLIC_FIRMA_SIGNING_BRANDING_PROXY:
      process.env.NEXT_PUBLIC_FIRMA_SIGNING_BRANDING_PROXY ??
      process.env.FIRMA_SIGNING_BRANDING_PROXY ??
      "1",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
