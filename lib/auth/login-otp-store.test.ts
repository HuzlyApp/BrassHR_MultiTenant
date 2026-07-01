import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGIN_OTP_INVALID_MESSAGE } from "@/lib/auth/login-api-errors";
import {
  createLoginOtp,
  hashLoginOtp,
  LOGIN_OTP_PURPOSE,
  verifyLoginOtp,
} from "@/lib/auth/login-otp-store";

type OtpRow = {
  id: string;
  email: string;
  user_id: string | null;
  purpose: string;
  otp_hash: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  invalidated_at: string | null;
};

function consumeAuthLoginOtp(rows: OtpRow[], email: string, purpose: string, otpHash: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const candidates = rows
    .filter(
      (row) =>
        row.email === normalizedEmail &&
        row.purpose === purpose &&
        row.used_at === null &&
        row.invalidated_at == null &&
        new Date(row.expires_at).getTime() > now
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const latest = candidates[0];
  if (!latest || latest.otp_hash !== otpHash) {
    return false;
  }

  latest.used_at = new Date().toISOString();
  return true;
}

function createInMemoryOtpSupabase(initialRows: OtpRow[] = []) {
  const rows = [...initialRows];
  let nextId = 1;

  const invalidateActive = (email: string, purpose: string, now: string) => {
    for (const row of rows) {
      if (
        row.email === email &&
        row.purpose === purpose &&
        row.used_at === null &&
        row.invalidated_at == null
      ) {
        row.invalidated_at = now;
      }
    }
  };

  const from = vi.fn((table: string) => {
    if (table !== "auth_login_otps") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const filters: Array<{ type: "eq" | "is"; column: string; value: unknown }> = [];

    const builder = {
      update(payload: Partial<OtpRow>) {
        return {
          eq(column: string, value: unknown) {
            filters.push({ type: "eq", column, value });
            return {
              eq(column2: string, value2: unknown) {
                filters.push({ type: "eq", column: column2, value: value2 });
                return {
                  is(column3: string, value3: unknown) {
                    filters.push({ type: "is", column: column3, value: value3 });
                    return {
                      is(column4: string, value4: unknown) {
                        filters.push({ type: "is", column: column4, value: value4 });
                        const now = payload.invalidated_at;
                        for (const row of rows) {
                          const matches = filters.every((filter) => {
                            if (filter.type === "eq") {
                              return (row as Record<string, unknown>)[filter.column] === filter.value;
                            }
                            return (row as Record<string, unknown>)[filter.column] == filter.value;
                          });
                          if (matches && now) {
                            row.invalidated_at = now;
                          }
                        }
                        return Promise.resolve({ error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
      insert(payload: Omit<OtpRow, "id">) {
        rows.push({
          id: `otp-${nextId++}`,
          used_at: null,
          invalidated_at: null,
          ...payload,
        });
        return Promise.resolve({ error: null });
      },
    };

    return builder;
  });

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "consume_auth_login_otp") {
      const email = String(args.p_email ?? "");
      const purpose = String(args.p_purpose ?? "");
      const otpHash = String(args.p_otp_hash ?? "");
      return {
        data: consumeAuthLoginOtp(rows, email, purpose, otpHash),
        error: null,
      };
    }

    if (fn === "issue_auth_login_otp") {
      const email = String(args.p_email ?? "").trim().toLowerCase();
      const purpose = String(args.p_purpose ?? "");
      const now = String(args.p_now ?? new Date().toISOString());
      const expiresAt = String(args.p_expires_at ?? "");
      invalidateActive(email, purpose, now);
      rows.push({
        id: `otp-${nextId++}`,
        email,
        user_id: (args.p_user_id as string | null) ?? null,
        purpose,
        otp_hash: String(args.p_otp_hash ?? ""),
        created_at: now,
        expires_at: expiresAt,
        used_at: null,
        invalidated_at: null,
      });
      return { data: null, error: null };
    }

    throw new Error(`Unexpected rpc: ${fn}`);
  });

  return {
    supabase: { from, rpc } as unknown as SupabaseClient,
    rows,
  };
}

describe("login OTP store", () => {
  const email = "user@example.com";
  const otherEmail = "other@example.com";
  const baseTime = new Date("2026-07-02T12:00:00.000Z");

  beforeEach(() => {
    process.env.LOGIN_OTP_PEPPER = "test-pepper";
    process.env.LOGIN_OTP_TTL_SECONDS = "600";
  });

  it("invalidates an old OTP after a new OTP is generated", async () => {
    const { supabase, rows } = createInMemoryOtpSupabase();
    const first = await createLoginOtp(supabase, {
      email,
      now: baseTime,
      code: "111111",
    });
    await createLoginOtp(supabase, {
      email,
      now: new Date(baseTime.getTime() + 1000),
      code: "222222",
    });

    expect(rows.filter((row) => row.invalidated_at !== null)).toHaveLength(1);
    expect(rows.find((row) => row.otp_hash === hashLoginOtp({ email, purpose: LOGIN_OTP_PURPOSE, code: first.code }))?.invalidated_at).not.toBeNull();

    const oldResult = await verifyLoginOtp(supabase, { email, code: first.code });
    expect(oldResult).toEqual({ ok: false, reason: "invalid" });
  });

  it("verifies the latest OTP successfully", async () => {
    const { supabase } = createInMemoryOtpSupabase();
    await createLoginOtp(supabase, { email, now: baseTime, code: "111111" });
    const latest = await createLoginOtp(supabase, {
      email,
      now: new Date(baseTime.getTime() + 1000),
      code: "222222",
    });

    await expect(verifyLoginOtp(supabase, { email, code: latest.code })).resolves.toEqual({ ok: true });
  });

  it("rejects an old OTP even when it has not expired", async () => {
    const { supabase } = createInMemoryOtpSupabase();
    const oldCode = "333333";
    await createLoginOtp(supabase, { email, now: baseTime, code: oldCode });
    await createLoginOtp(supabase, {
      email,
      now: new Date(baseTime.getTime() + 2000),
      code: "444444",
    });

    await expect(verifyLoginOtp(supabase, { email, code: oldCode })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects an expired latest OTP", async () => {
    const { supabase, rows } = createInMemoryOtpSupabase();
    const created = await createLoginOtp(supabase, { email, now: baseTime, code: "555555" });
    const row = rows[0];
    row.expires_at = new Date(Date.now() - 60_000).toISOString();

    await expect(verifyLoginOtp(supabase, { email, code: created.code })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("does not allow reusing a consumed OTP", async () => {
    const { supabase } = createInMemoryOtpSupabase();
    const created = await createLoginOtp(supabase, { email, now: baseTime, code: "666666" });

    await expect(verifyLoginOtp(supabase, { email, code: created.code })).resolves.toEqual({ ok: true });
    await expect(verifyLoginOtp(supabase, { email, code: created.code })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("leaves only the newest OTP valid after multiple resends", async () => {
    const { supabase } = createInMemoryOtpSupabase();
    const first = await createLoginOtp(supabase, { email, now: baseTime, code: "111111" });
    await createLoginOtp(supabase, {
      email,
      now: new Date(baseTime.getTime() + 1000),
      code: "222222",
    });
    const third = await createLoginOtp(supabase, {
      email,
      now: new Date(baseTime.getTime() + 2000),
      code: "333333",
    });

    await expect(verifyLoginOtp(supabase, { email, code: first.code })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
    await expect(verifyLoginOtp(supabase, { email, code: "222222" })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
    await expect(verifyLoginOtp(supabase, { email, code: third.code })).resolves.toEqual({ ok: true });
  });

  it("rejects an OTP when purpose does not match", async () => {
    const { supabase } = createInMemoryOtpSupabase();
    const created = await createLoginOtp(supabase, {
      email,
      now: baseTime,
      code: "777777",
      purpose: "login",
    });

    await expect(
      verifyLoginOtp(supabase, { email, code: created.code, purpose: "password_reset" })
    ).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an OTP for a different user email", async () => {
    const { supabase } = createInMemoryOtpSupabase();
    const created = await createLoginOtp(supabase, { email, now: baseTime, code: "888888" });

    await expect(verifyLoginOtp(supabase, { email: otherEmail, code: created.code })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("uses the expected invalid OTP message constant", () => {
    expect(LOGIN_OTP_INVALID_MESSAGE).toBe("Invalid or expired OTP.");
  });
});
