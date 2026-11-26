import type { NextConfig } from "next";
import { appContentSecurityPolicy, APP_PERMISSIONS_POLICY } from "./lib/security/content-security-policy";
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
  {
    source: "/admin_recruiter/new/applicants",
    destination: "/admin_recruiter/applications",
    permanent: false,
  },
  {
    source: "/admin_recruiter/candidates/:workerId/hire-journey",
    destination: "/admin_recruiter/new/pre-hire/:workerId",
    permanent: false,
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
  return appContentSecurityPolicy({ frameAncestors });
}

const nextConfig: NextConfig = {
  // Prevent Next.js from rewriting AGENTS.md on every boot (causes HMR/config restart loops).
  agentRules: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons"],
    agentUpgrade: "security",
  },
  // Keep PDF.js out of the server chunk. The bundled pdf-parse build throws
  // "bad XRef entry" on valid PDFs (including ReportLab résumés).
  serverExternalPackages: ["pdfjs-dist", "pdf-parse"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/pdfjs-dist/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js",
      "./node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.worker.js",
    ],
  },
  images: {
    remotePatterns: getSupabaseImageRemotePatterns(),
  },
  async redirects() {
    return legacyOnboardingRedirects;
  },
  async headers() {
    const baseSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      {
        key: "Permissions-Policy",
        // Only the app and its explicit telephony origins may request device access.
        value:
          APP_PERMISSIONS_POLICY,
      },
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
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.next/**",
          "**/.playwright-cli/**",
          "**/cache/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
