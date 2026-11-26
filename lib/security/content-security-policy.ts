type PolicyOptions = { nonce?: string; frameAncestors?: string; development?: boolean };

export function appContentSecurityPolicy({ nonce, frameAncestors = "'self'", development = process.env.NODE_ENV === "development" }: PolicyOptions = {}): string {
  const connections = new Set(["'self'", "https://api.firma.dev", "https://app.firma.dev", "https://dialpad.com", "https://*.dialpad.com", "wss://*.dialpad.com", "https://api.mapbox.com", "https://events.mapbox.com", "https://vitals.vercel-insights.com", "https://va.vercel-scripts.com"]);
  const database = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (database) {
    try {
      const url = new URL(database);
      if (url.protocol === "https:" || (development && url.protocol === "http:")) {
        connections.add(url.origin);
        connections.add(url.origin.replace(/^http/, "ws"));
      }
    } catch { /* Invalid configuration must not broaden the policy. */ }
  }
  if (development) { connections.add("ws://localhost:*"); connections.add("ws://127.0.0.1:*"); }
  return [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    `script-src 'self'${nonce ? ` 'nonce-${nonce}' 'strict-dynamic'` : ""}${development ? " 'unsafe-eval'" : ""} https://api.firma.dev https://app.firma.dev`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.cdnfonts.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${[...connections].join(" ")}`,
    "worker-src 'self' blob: https://api.firma.dev https://app.firma.dev",
    "frame-src 'self' https://app.firma.dev https://api.firma.dev https://dialpad.com https://app.dialpad.com",
    "form-action 'self'", "upgrade-insecure-requests",
  ].filter(rule => !development || rule !== "upgrade-insecure-requests").join("; ");
}

export const APP_PERMISSIONS_POLICY = 'camera=(self "https://dialpad.com" "https://app.dialpad.com"), microphone=(self "https://dialpad.com" "https://app.dialpad.com"), speaker-selection=(self "https://dialpad.com" "https://app.dialpad.com"), display-capture=(), autoplay=(self "https://dialpad.com" "https://app.dialpad.com"), geolocation=(self)';

/** Preserve the existing auth middleware scope when applying headers to every HTML route. */
export function usesSessionProxy(path: string): boolean {
  if (["/", "/your-trial", "/tenant-host-not-found", "/worker-onboarding", "/worker-signin", "/candidate-signin"].includes(path)) return true;
  return ["/login", "/signin", "/admin", "/signup", "/tenant-onboarding", "/admin_recruiter", "/application", "/api/workers", "/api/search-workers", "/api/admin", "/godadmin", "/api/godadmin"].some(prefix => path === prefix || path.startsWith(prefix + "/"));
}
