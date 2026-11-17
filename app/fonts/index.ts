/**
 * Self-hosted fonts only.
 *
 * Do not import from `next/font/google` — Next 16 Turbopack builds can fail with
 * "next/font/google queries have exactly one entry" when Google returns
 * extensionless `/l/font?kit=...&skey=...` URLs (vercel/next.js#99114).
 */
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const geistSans = GeistSans;
export const geistMono = GeistMono;

export const tenantBrandingInter = localFont({
  src: [
    { path: "./files/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./files/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./files/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-tenant-branding-inter",
  display: "swap",
});

export const tenantBrandingRoboto = localFont({
  src: [
    { path: "./files/roboto-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/roboto-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./files/roboto-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-tenant-branding-roboto",
  display: "swap",
});

export const tenantBrandingPoppins = localFont({
  src: [
    { path: "./files/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./files/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-tenant-branding-poppins",
  display: "swap",
});

export const tenantBrandingUbuntu = localFont({
  src: [
    { path: "./files/ubuntu-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/ubuntu-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./files/ubuntu-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-tenant-branding-ubuntu",
  display: "swap",
});
