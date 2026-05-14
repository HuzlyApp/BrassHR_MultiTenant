import type { Metadata } from "next";
import BrassHRLanding from "@/app/components/BrassHRLanding";

export const metadata: Metadata = {
  title: { absolute: "BrassHR — HR simplified for growing teams" },
  description:
    "HR simplified for growing teams. Hire, manage, and pay your people with ease. Employee records, scheduling, timekeeping, and payroll-ready exports—all in one place.",
};

export default function Home() {
  return <BrassHRLanding />;
}
