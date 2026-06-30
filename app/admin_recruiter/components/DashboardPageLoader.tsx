"use client";

type DashboardPageLoaderProps = {
  label?: string;
  overlay?: boolean;
  /** Fill the main content area below the worker portal header. */
  layout?: "default" | "page";
  className?: string;
};

/** Intentionally renders nothing — admin recruiter pages show content without pending API spinners. */
export default function DashboardPageLoader(_props: DashboardPageLoaderProps) {
  return null;
}
