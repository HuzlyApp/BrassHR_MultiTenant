"use client";

import { Suspense } from "react";
import { PasswordSetupContent } from "./PasswordSetupContent";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#f3f4f6]" aria-hidden="true" />}>
      <PasswordSetupContent mode="reset" />
    </Suspense>
  );
}
