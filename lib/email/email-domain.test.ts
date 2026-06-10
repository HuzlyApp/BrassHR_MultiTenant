import { describe, expect, it } from "vitest";
import {
  CURRENT_EMAIL_DOMAIN,
  emailLookupVariants,
  emailsMatchWithLegacyDomain,
  extractBareEmailAddress,
  LEGACY_EMAIL_DOMAIN,
  migrateEmailDomain,
  toLegacyEmailVariant,
} from "@/lib/email/email-domain";

describe("migrateEmailDomain", () => {
  it("migrates @nexusmedpro.com to @brasshr.com preserving local-part", () => {
    expect(migrateEmailDomain("john@nexusmedpro.com")).toBe(`john@${CURRENT_EMAIL_DOMAIN}`);
    expect(migrateEmailDomain("John.Doe@NexusMedPro.COM")).toBe(`john.doe@${CURRENT_EMAIL_DOMAIN}`);
  });

  it("does not change unrelated domains", () => {
    expect(migrateEmailDomain("jane@gmail.com")).toBe("jane@gmail.com");
    expect(migrateEmailDomain(`staff@${CURRENT_EMAIL_DOMAIN}`)).toBe(`staff@${CURRENT_EMAIL_DOMAIN}`);
  });
});

describe("toLegacyEmailVariant", () => {
  it("returns legacy variant for current domain emails", () => {
    expect(toLegacyEmailVariant(`john@${CURRENT_EMAIL_DOMAIN}`)).toBe(`john@${LEGACY_EMAIL_DOMAIN}`);
  });

  it("returns null for unrelated domains", () => {
    expect(toLegacyEmailVariant("jane@gmail.com")).toBeNull();
    expect(toLegacyEmailVariant(`old@${LEGACY_EMAIL_DOMAIN}`)).toBeNull();
  });
});

describe("emailLookupVariants", () => {
  it("includes both legacy and current domain for migrated addresses", () => {
    const variants = emailLookupVariants("john@nexusmedpro.com");
    expect(variants).toContain("john@nexusmedpro.com");
    expect(variants).toContain(`john@${CURRENT_EMAIL_DOMAIN}`);
  });

  it("includes legacy variant when querying by current domain", () => {
    const variants = emailLookupVariants(`john@${CURRENT_EMAIL_DOMAIN}`);
    expect(variants).toContain(`john@${CURRENT_EMAIL_DOMAIN}`);
    expect(variants).toContain(`john@${LEGACY_EMAIL_DOMAIN}`);
  });

  it("only returns one variant for external domains", () => {
    expect(emailLookupVariants("jane@gmail.com")).toEqual(["jane@gmail.com"]);
  });
});

describe("emailsMatchWithLegacyDomain", () => {
  it("matches legacy and current domain for same local-part", () => {
    expect(
      emailsMatchWithLegacyDomain("john@nexusmedpro.com", `john@${CURRENT_EMAIL_DOMAIN}`)
    ).toBe(true);
  });

  it("does not match different local-parts or unrelated domains", () => {
    expect(emailsMatchWithLegacyDomain("john@gmail.com", "jane@gmail.com")).toBe(false);
    expect(
      emailsMatchWithLegacyDomain("john@gmail.com", `john@${CURRENT_EMAIL_DOMAIN}`)
    ).toBe(false);
  });
});

describe("extractBareEmailAddress", () => {
  it("parses display-name wrapped addresses", () => {
    expect(extractBareEmailAddress("Jane Doe <jane@example.com>")).toBe("jane@example.com");
  });

  it("returns bare addresses unchanged", () => {
    expect(extractBareEmailAddress("jane@example.com")).toBe("jane@example.com");
  });
});
