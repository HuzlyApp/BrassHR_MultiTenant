import { Inter } from "next/font/google";
import type { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-brass-onboarding",
  display: "swap",
});

export default function TenantOnboardingLayout({ children }: { children: ReactNode }) {
  return <div className={`${inter.className} ${inter.variable}`}>{children}</div>;
}
