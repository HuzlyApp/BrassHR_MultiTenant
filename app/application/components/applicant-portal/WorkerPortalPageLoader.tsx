"use client";

type Props = {
  label?: string;
  className?: string;
};

/** Intentionally renders nothing — worker portal pages show content without pending API spinners. */
export function WorkerPortalPageLoader(_props: Props) {
  return null;
}
