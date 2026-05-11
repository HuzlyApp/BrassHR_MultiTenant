import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TenantBrandingRoot from "@/app/components/tenant/TenantBrandingRoot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Onboarding",
    template: "%s | Onboarding",
  },
  description: "Configurable applicant and recruiter onboarding for healthcare staffing teams.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          antialiased
          bg-white
          text-gray-900
          min-h-screen
        `}
      >
        <TenantBrandingRoot>{children}</TenantBrandingRoot>
      </body>
    </html>
  );
}