import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPasswordRules,
  isPasswordStrongEnough,
  updateAuthUserPassword,
  validatePasswordUpdate,
} from "@/lib/account/password-update";

describe("validatePasswordUpdate", () => {
  it("requires a new password", () => {
    expect(validatePasswordUpdate("", "Secret1a")).toBe("New password is required.");
  });

  it("requires confirm password", () => {
    expect(validatePasswordUpdate("Secret1a", "")).toBe("Confirm password is required.");
  });

  it("rejects password mismatch", () => {
    expect(validatePasswordUpdate("Secret1a", "Secret1b")).toBe("Passwords do not match.");
  });

  it("rejects weak passwords missing minimum length", () => {
    expect(validatePasswordUpdate("Sec1a", "Sec1a")).toMatch(/8 characters/i);
  });

  it("rejects weak passwords missing a number", () => {
    expect(validatePasswordUpdate("Secretaa", "Secretaa")).toMatch(/number/i);
  });

  it("rejects weak passwords missing uppercase", () => {
    expect(validatePasswordUpdate("secret1a", "secret1a")).toMatch(/uppercase/i);
  });

  it("rejects weak passwords missing lowercase", () => {
    expect(validatePasswordUpdate("SECRET1A", "SECRET1A")).toMatch(/lowercase/i);
  });

  it("accepts a valid password pair", () => {
    expect(validatePasswordUpdate("Secret1a", "Secret1a")).toBeNull();
  });
});

describe("getPasswordRules / isPasswordStrongEnough", () => {
  it("marks matching strong passwords as valid", () => {
    const rules = getPasswordRules("Secret1a", "Secret1a");
    expect(isPasswordStrongEnough(rules)).toBe(true);
    expect(rules.passwordsMatch).toBe(true);
  });
});

describe("updateAuthUserPassword", () => {
  it("calls Supabase Auth updateUser with the new password", async () => {
    const updateUser = vi.fn(async () => ({ data: { user: null }, error: null }));
    const supabase = { auth: { updateUser } } as unknown as Pick<SupabaseClient, "auth">;

    await updateAuthUserPassword(supabase, "Secret1a");

    expect(updateUser).toHaveBeenCalledOnce();
    expect(updateUser).toHaveBeenCalledWith({ password: "Secret1a" });
  });

  it("surfaces Supabase Auth errors", async () => {
    const updateUser = vi.fn(async () => ({
      data: { user: null },
      error: { message: "Password is too weak", name: "AuthWeakPasswordError", status: 422 },
    }));
    const supabase = { auth: { updateUser } } as unknown as Pick<SupabaseClient, "auth">;

    await expect(updateAuthUserPassword(supabase, "Secret1a")).rejects.toMatchObject({
      message: "Password is too weak",
    });
  });

  it("does not write passwords to public database tables", async () => {
    const updateUser = vi.fn(async () => ({ data: { user: null }, error: null }));
    const from = vi.fn();
    const supabase = {
      auth: { updateUser },
      from,
    } as unknown as SupabaseClient;

    await updateAuthUserPassword(supabase, "Secret1a");

    expect(from).not.toHaveBeenCalled();
  });
});
