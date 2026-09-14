import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateServiceAreaWithDb, insertServiceAreaWaitlist } from "@/lib/service-area/db";
import { isPhase1RestrictedState } from "@/lib/service-area/known-cities";
import { ACCOUNT_ACCESS_ACTIVE, ACCOUNT_ACCESS_WAITLIST } from "@/lib/service-area/types";
import { normalizeStateCode } from "@/lib/service-area/normalize";

export async function evaluateSignupPrimaryLocation(
  supabase: SupabaseClient,
  input: {
    city: string;
    state: string;
    postalCode?: string | null;
    hqState?: string | null;
    email?: string | null;
  }
) {
  const decision = await evaluateServiceAreaWithDb(supabase, {
    action: "signup",
    location: {
      country: "US",
      city: input.city,
      state: input.state,
      postalCode: input.postalCode ?? null,
      locationType: "onsite",
    },
  });

  const hqState = normalizeStateCode(input.hqState);
  const hqInHold = Boolean(hqState) && isPhase1RestrictedState(hqState) && decision.allowed;

  if (!decision.allowed && input.email) {
    await insertServiceAreaWaitlist(supabase, {
      email: input.email,
      city: input.city,
      state: input.state,
      source: "signup",
    });
  }

  return {
    decision,
    hqInHold,
    accountAccess: decision.allowed ? ACCOUNT_ACCESS_ACTIVE : ACCOUNT_ACCESS_WAITLIST,
  };
}
