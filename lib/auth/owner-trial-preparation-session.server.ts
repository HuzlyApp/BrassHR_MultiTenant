import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { OWNER_TRIAL_PREPARATION_SESSION_COOKIE } from "@/lib/tenant/constants";
import {
  OWNER_TRIAL_PREPARATION_TTL_SECONDS,
  type OwnerTrialPreparationPhase,
  type OwnerTrialPreparationStatus,
} from "@/lib/auth/owner-trial-preparation-types";

export { OWNER_TRIAL_PREPARATION_TTL_SECONDS };
export type { OwnerTrialPreparationPhase, OwnerTrialPreparationStatus };

function preparationSecret(): string {
  const secret =
    process.env.OWNER_TRIAL_PREPARATION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Missing OWNER_TRIAL_PREPARATION_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", preparationSecret()).update(payload, "utf8").digest("base64url");
}

export function createOwnerTrialPreparationToken(userId: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + OWNER_TRIAL_PREPARATION_TTL_SECONDS;
  const payload = `${userId.trim()}.${exp}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signPayload(payload)}`;
}

export function verifyOwnerTrialPreparationToken(
  token: string | null | undefined,
  nowMs = Date.now()
): { userId: string } | null {
  const raw = token?.trim();
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const encodedPayload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  let payload = "";
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = signPayload(payload);
  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  const [userId, expRaw] = payload.split(".");
  const exp = Number(expRaw);
  if (!userId?.trim() || !Number.isFinite(exp) || exp <= Math.floor(nowMs / 1000)) {
    return null;
  }

  return { userId: userId.trim() };
}

export function readOwnerTrialPreparationUserId(request: NextRequest): string | null {
  const token = request.cookies.get(OWNER_TRIAL_PREPARATION_SESSION_COOKIE)?.value;
  return verifyOwnerTrialPreparationToken(token)?.userId ?? null;
}

export function setOwnerTrialPreparationCookie(response: NextResponse, userId: string): void {
  response.cookies.set(OWNER_TRIAL_PREPARATION_SESSION_COOKIE, createOwnerTrialPreparationToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_TRIAL_PREPARATION_TTL_SECONDS,
  });
}

export function clearOwnerTrialPreparationCookie(response: NextResponse): void {
  response.cookies.set(OWNER_TRIAL_PREPARATION_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
