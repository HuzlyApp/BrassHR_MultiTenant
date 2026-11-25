"use client";

import { Suspense } from "react";
import { PasswordSetupContent } from "@/app/reset-password/PasswordSetupContent";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#f3f4f6]" aria-hidden="true" />}>
      <PasswordSetupContent mode="invite" />
    </Suspense>
  );
}
