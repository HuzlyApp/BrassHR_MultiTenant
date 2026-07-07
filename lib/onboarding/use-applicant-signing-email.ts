"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import {
  normalizeApplicantEmail,
  pickDeliverableEmailFromSources,
  readApplicantSigningEmailFromLocalStorage,
} from "@/lib/onboarding/resolve-applicant-signing-email";
import { isDeliverableApplicantEmail } from "@/lib/onboardingStep1Validation";

export type ApplicantSigningEmailState = {
  email: string;
  firstName: string;
  lastName: string;
  loading: boolean;
  resolved: boolean;
};

type SigningProfileResponse = {
  profile?: {
    email?: string;
    firstName?: string;
    lastName?: string | null;
  };
  error?: string;
  code?: string;
};

function buildSignerName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return `${firstName?.trim() ?? ""} ${lastName?.trim() ?? ""}`.trim();
}

/**
 * Resolves the applicant email for Firma signing from local drafts, auth session,
 * and the onboarding signing-profile API (authoritative when available).
 */
export function useApplicantSigningEmail(params: {
  applicantId: string | null;
  tenantSlug?: string | null;
}): ApplicantSigningEmailState {
  const { applicantId, tenantSlug } = params;
  const [state, setState] = useState<ApplicantSigningEmailState>({
    email: "",
    firstName: "",
    lastName: "",
    loading: true,
    resolved: false,
  });

  useEffect(() => {
    if (!applicantId) {
      setState({ email: "", firstName: "", lastName: "", loading: false, resolved: true });
      return;
    }

    let cancelled = false;

    const local = readApplicantSigningEmailFromLocalStorage();
    const localEmail = local.email ?? "";
    const localName = buildSignerName(local.firstName, local.lastName);

    if (localEmail || localName) {
      setState((prev) => ({
        ...prev,
        email: localEmail || prev.email,
        firstName: local.firstName ?? prev.firstName,
        lastName: local.lastName ?? prev.lastName,
        loading: true,
        resolved: false,
      }));
    }

    void (async () => {
      let emailFromFormState = localEmail;
      let emailFromProfile: string | null = null;
      let emailFromCandidate: string | null = null;
      let finalResolvedEmail: string | null = localEmail || null;
      let firstName = local.firstName ?? "";
      let lastName = local.lastName ?? "";

      try {
        const { data: authData } = await supabase.auth.getUser();
        const authEmail = normalizeApplicantEmail(authData?.user?.email);
        emailFromCandidate = isDeliverableApplicantEmail(authEmail) ? authEmail : null;
        finalResolvedEmail = pickDeliverableEmailFromSources(
          finalResolvedEmail,
          emailFromCandidate
        );

        const query = new URLSearchParams({ applicantId });
        if (tenantSlug) query.set("tenantSlug", tenantSlug);

        const res = await fetch(`/api/onboarding/applicant-signing-profile?${query.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as SigningProfileResponse;

        if (res.ok && json.profile?.email) {
          emailFromProfile = normalizeApplicantEmail(json.profile.email);
          if (isDeliverableApplicantEmail(emailFromProfile)) {
            finalResolvedEmail = emailFromProfile;
            firstName = json.profile.firstName?.trim() || firstName;
            lastName = json.profile.lastName?.trim() || lastName;
          }
        } else if (!finalResolvedEmail) {
          finalResolvedEmail = pickDeliverableEmailFromSources(emailFromCandidate);
        }

        if (process.env.NODE_ENV === "development") {
          console.log("[agreement-email-debug]", {
            onboardingSessionId: applicantId,
            applicantId,
            candidateId: authData?.user?.id ?? null,
            emailFromFormState,
            emailFromProfile,
            emailFromCandidate,
            finalResolvedEmail,
          });
        }
      } catch (err) {
        console.warn("[useApplicantSigningEmail]", err);
        finalResolvedEmail = pickDeliverableEmailFromSources(
          finalResolvedEmail,
          emailFromCandidate
        );
      }

      if (cancelled) return;

      setState({
        email: finalResolvedEmail ?? "",
        firstName,
        lastName,
        loading: false,
        resolved: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [applicantId, tenantSlug]);

  return state;
}
