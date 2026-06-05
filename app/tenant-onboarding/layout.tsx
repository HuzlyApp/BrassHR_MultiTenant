import { Inter, Poppins, Roboto, Ubuntu } from "next/font/google";
import type { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-tenant-branding-inter",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tenant-branding-roboto",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-tenant-branding-poppins",
  display: "swap",
});

const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tenant-branding-ubuntu",
  display: "swap",
});

export default function TenantOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`tenant-onboarding-light min-h-screen bg-white text-[#0f172a] ${inter.variable} ${roboto.variable} ${poppins.variable} ${ubuntu.variable}`}
      style={{ colorScheme: "light only" }}
    >
      {children}
    </div>
  );
}
