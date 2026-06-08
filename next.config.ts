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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getSupabaseImageRemotePatterns(),
  },
  async redirects() {
    return legacyOnboardingRedirects;
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "connect-src 'self' https:",
          "frame-src 'self' https:",
        ].join("; "),
      },
    ];
    return [
      {
        source: "/:path*",
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
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
