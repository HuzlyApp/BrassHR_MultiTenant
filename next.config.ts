import type { NextConfig } from "next";
import { LEGACY_APPLICATION_ROUTE_REDIRECTS } from "./lib/onboarding/application-routes";

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
  async redirects() {
    return legacyOnboardingRedirects;
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
