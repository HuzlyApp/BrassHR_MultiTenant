"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { applicantPortalApiPath } from "@/lib/applicant-portal/client-tenant";
import { portalHomePath } from "@/lib/auth/portal-rbac";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { applicationPath } from "@/lib/tenant/with-tenant";

type LookupResponse = {
  error?: string;
  applicationStatus?: string;
  statusLabel?: string;
  message?: string;
  requiresPasswordSetup?: boolean;
  portalRole?: "candidate" | "worker";
};

export type ApplicantSignInMode = "email" | "password" | "setup";

const unapprovedMessage =
  "Your application has not been approved yet. You will be able to access your applicant dashboard once your application has been approved.";

export function useApplicantSignIn(
  tenantSlug: string | null,
  portal: "worker" | "candidate" = "worker"
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<ApplicantSignInMode>("email");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signInReady, setSignInReady] = useState(false);

  async function parseResponse(res: Response): Promise<LookupResponse> {
    return (await res.json().catch(() => ({}))) as LookupResponse;
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantSlug) {
      setError("Select your organization before signing in.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await fetch("/api/applicant-portal/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, tenantSlug }),
    });
    const payload = await parseResponse(res);
    setLoading(false);

    if (!res.ok) {
      setStatusLabel(payload.statusLabel ?? null);
      setError(payload.error || unapprovedMessage);
      return;
    }

    setStatusLabel(payload.statusLabel ?? "Approved");
    setNotice(payload.message ?? "Your application has been approved.");
    setMode(payload.requiresPasswordSetup ? "setup" : "password");
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantSlug) {
      setError("Select your organization before signing in.");
      return;
    }

    setError(null);

    if (password !== confirmPassword) {
      setError("Password fields do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/applicant-portal/setup-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword, tenantSlug }),
    });
    const payload = await parseResponse(res);

    if (!res.ok) {
      setLoading(false);
      setError(payload.error || "Could not set your password.");
      return;
    }

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setMode("password");
      setError(signInError.message);
      return;
    }

    const mismatch = await rejectWrongPortal();
    if (mismatch) {
      setError(mismatch);
      return;
    }

    setSignInReady(true);
  }

  async function rejectWrongPortal(): Promise<string | null> {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(applicantPortalApiPath("/api/applicant-portal/session", tenantSlug), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    const payload = await parseResponse(res);
    const role = payload.portalRole;
    const wrongCandidate = portal === "candidate" && role !== "candidate";
    const wrongWorker = portal === "worker" && role === "candidate";
    if (!res.ok || wrongCandidate || wrongWorker) {
      await supabaseBrowser.auth.signOut();
      if (wrongCandidate) return "This email is a worker account. Use Worker sign in.";
      if (wrongWorker) return "This email is a candidate account. Use Candidate sign in.";
      return payload.error || unapprovedMessage;
    }
    return null;
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantSlug) {
      setError("Select your organization before signing in.");
      return;
    }

    setError(null);
    setLoading(true);

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const mismatch = await rejectWrongPortal();
    setLoading(false);

    if (mismatch) {
      setError(mismatch);
      return;
    }

    setSignInReady(true);
  }

  async function completeSignIn(rememberMe: boolean) {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (rememberMe && normalizedEmail) {
        localStorage.setItem("workerSignInEmail", normalizedEmail);
      } else {
        localStorage.removeItem("workerSignInEmail");
      }
    } catch {
      /* ignore storage errors */
    }

    if (!tenantSlug) return;
    const next = searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : portalHomePath(portal);
    router.push(applicationPath(destination, tenantSlug));
  }

  function resetToEmail() {
    setPassword("");
    setConfirmPassword("");
    setMode("email");
    setError(null);
    setNotice(null);
    setStatusLabel(null);
    setSignInReady(false);
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    mode,
    setMode,
    error,
    setError,
    loading,
    handleLookup,
    handleSetup,
    handlePasswordLogin,
    resetToEmail,
    signInReady,
    completeSignIn,
  };
}
