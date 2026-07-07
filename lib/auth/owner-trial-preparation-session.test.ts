import { describe, expect, it } from "vitest";
import {
  createOwnerTrialPreparationToken,
  verifyOwnerTrialPreparationToken,
  OWNER_TRIAL_PREPARATION_TTL_SECONDS,
} from "@/lib/auth/owner-trial-preparation-session.server";

describe("owner-trial-preparation-session", () => {
  const userId = "11111111-1111-1111-1111-111111111111";

  it("creates and verifies a signed trial preparation token", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
    const token = createOwnerTrialPreparationToken(userId);
    expect(verifyOwnerTrialPreparationToken(token)).toEqual({ userId });
  });

  it("rejects expired trial preparation tokens", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
    const expiredNow = Date.now() + (OWNER_TRIAL_PREPARATION_TTL_SECONDS + 5) * 1000;
    const token = createOwnerTrialPreparationToken(
      userId,
      expiredNow - OWNER_TRIAL_PREPARATION_TTL_SECONDS * 1000 - 1000
    );
    expect(verifyOwnerTrialPreparationToken(token, expiredNow)).toBeNull();
  });
});
