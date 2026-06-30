import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ReactQueryProvider from "@/app/components/ReactQueryProvider";
import TenantBrandingRoot from "@/app/components/tenant/TenantBrandingRoot";
import TenantBrandingHead from "@/app/components/tenant/TenantBrandingHead";
import { Toaster } from "react-hot-toast";
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
    icon: "/icons/braas-HR/BrassHR-logo.svg",
    shortcut: "/icons/braas-HR/BrassHR-logo.svg",
    apple: "/icons/braas-HR/BrassHR-logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          antialiased
          bg-white
          text-gray-900
          min-h-screen
        `}
      >
        <TenantBrandingHead />
        <ReactQueryProvider>
          <TenantBrandingRoot>{children}</TenantBrandingRoot>
          <Toaster position="top-right" />
        </ReactQueryProvider>
      </body>
    </html>
  );
}