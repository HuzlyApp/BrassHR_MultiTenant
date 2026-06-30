"use client";

type CandidateDetailLoaderProps = {
  label?: string;
  className?: string;
};

/** Intentionally renders nothing — admin recruiter pages show content without pending API spinners. */
export default function CandidateDetailLoader(_props: CandidateDetailLoaderProps) {
  return null;
}
