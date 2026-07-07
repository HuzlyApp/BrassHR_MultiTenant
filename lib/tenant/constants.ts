/** Cookie: god-admin “view as” scoped tenant UUID (HTTP-only via API Routes). */
export const VIEW_AS_TENANT_COOKIE = "view_as_tenant_id";

/** Optional override for anon applicant onboarding flows (marketing landing → application). */
export const ONBOARDING_TENANT_SLUG_COOKIE = "onboarding_tenant_slug";

/** Short-lived HTTP-only resume context set after a continuation link is redeemed. */
export const APPLICANT_CONTINUATION_SESSION_COOKIE = "applicant_continuation_session";

/** Short-lived HTTP-only owner context set after tenant signup continuation link is redeemed. */
export const OWNER_ONBOARDING_CONTINUATION_SESSION_COOKIE = "owner_onboarding_continuation_session";

/** Keeps `/your-trial` accessible while trial prep runs, even if Supabase auth session expires. */
export const OWNER_TRIAL_PREPARATION_SESSION_COOKIE = "owner_trial_preparation_session";
