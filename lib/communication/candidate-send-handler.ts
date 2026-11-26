import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import type { StaffApiAuthContext } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { getCompanyNotificationEmail } from "@/lib/communication/conversation";
import { CommunicationConfigError } from "@/lib/communication/env";
import { checkCommunicationRateLimit } from "@/lib/communication/rate-limit";
import { listCandidateCommunicationsWithThreads, recordCandidateCommunication } from "@/lib/communication/record";
import { resolveWorkerContact } from "@/lib/communication/resolve-worker";
import {
  sendCandidateEmailSchema,
  sendCandidateSmsSchema,
} from "@/lib/communication/schemas";
import { sendCandidateEmail } from "@/lib/communication/send-candidate-email";
import { sendCandidateSms } from "@/lib/communication/send-candidate-sms";
import { createNotification } from "@/lib/notifications/create-notification";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

function validationError(e: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "Validation failed",
      issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
    { status: 400 }
  );
}

function configError(e: CommunicationConfigError): NextResponse {
  return NextResponse.json({ error: e.message }, { status: e.status });
}

export async function handleSendCandidateEmail(
  auth: StaffApiAuthContext,
  workerIdRaw: string,
  body: unknown
): Promise<NextResponse> {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }
  const workerId = idCheck.value;

  const rate = checkCommunicationRateLimit(auth.userId);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many messages sent. Please try again later.",
        retryAfterSec: rate.retryAfterSec,
      },
      { status: 429 }
    );
  }

  let payload: z.infer<typeof sendCandidateEmailSchema>;
  try {
    payload = sendCandidateEmailSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return validationError(e);
    throw e;
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const contact = await resolveWorkerContact(supabase, workerId);
  if (!contact) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (!canAccessWorkerRecord(auth, { id: contact.id, user_id: contact.userId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!contact.email) {
    return NextResponse.json(
      { error: "This candidate does not have an email address on file." },
      { status: 400 }
    );
  }

  if (!contact.tenantId) {
    return NextResponse.json({ error: "Candidate tenant is missing" }, { status: 400 });
  }

  let sendResult: Awaited<ReturnType<typeof sendCandidateEmail>>;
  try {
    sendResult = await sendCandidateEmail({
      to: contact.email,
      subject: payload.subject,
      body: payload.body,
      bodyHtml: payload.bodyHtml,
    });
  } catch (e) {
    if (e instanceof CommunicationConfigError) return configError(e);
    throw e;
  }

  const row = await recordCandidateCommunication(supabase, {
    tenantId: contact.tenantId,
    workerId: contact.id,
    sentByUserId: auth.devBypass ? null : auth.userId,
    channel: "email",
    recipient: contact.email,
    contactEmail: contact.email,
    fromEmail: getCompanyNotificationEmail(),
    toEmail: contact.email,
    subject: payload.subject,
    body: payload.body,
    bodyHtml: payload.bodyHtml,
    providerMessageId: sendResult.ok ? sendResult.messageId : null,
    status: sendResult.ok ? "sent" : "failed",
    direction: "outbound",
    errorMessage: sendResult.ok ? null : sendResult.error,
  });

  if (!sendResult.ok) {
    return NextResponse.json(
      { error: sendResult.error, record: row },
      { status: 502 }
    );
  }

  const applicantUserId = await resolveCandidatePortalUserId(supabase, contact);
  const tenantId = contact.tenantId?.trim() || "";
  if (applicantUserId && tenantId) {
    const title = payload.subject?.trim() || "New message from your recruiter";
    const plainBody =
      payload.body?.trim() ||
      (payload.bodyHtml ? payload.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
    const created = await createNotification(supabase, {
      tenantId,
      userId: applicantUserId,
      type: "admin_email",
      title,
      body: plainBody ? plainBody.slice(0, 500) : null,
      link: "/application/candidate/notifications",
    });
    if (!created) {
      console.error("[candidate-email:notify] createNotification returned null", {
        workerId: contact.id,
        userId: applicantUserId,
        tenantId,
      });
    }
  } else {
    console.warn("[candidate-email:notify] skipped — missing portal user_id or tenantId", {
      workerId: contact.id,
      email: contact.email,
      userId: applicantUserId,
      tenantId: contact.tenantId,
    });
  }

  return NextResponse.json({
    ok: true,
    messageId: sendResult.messageId,
    record: row,
  });
}

async function resolveCandidatePortalUserId(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  contact: { id: string; userId: string | null; email: string | null; tenantId: string | null }
): Promise<string | null> {
  const existing = contact.userId?.trim() ?? "";
  if (existing) return existing;

  const email = contact.email?.trim().toLowerCase() ?? "";
  if (!email) return null;

  // Fall back: auth user with the same email (portal login exists but worker.user_id not linked).
  try {
    const matchedId = await findAuthUserIdByEmail(email);
    if (!matchedId) return null;

    await supabase
      .from("worker")
      .update({ user_id: matchedId, updated_at: new Date().toISOString() })
      .eq("id", contact.id)
      .is("user_id", null);

    return matchedId;
  } catch (err) {
    console.error("[candidate-email:notify] resolveCandidatePortalUserId", err);
    return null;
  }
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const baseUrl = getSupabaseUrl()?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceKey) return null;

  const url = `${baseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[candidate-email:notify] auth admin users lookup failed", res.status);
    return null;
  }

  const payload = (await res.json().catch(() => null)) as
    | { users?: Array<{ id?: string; email?: string | null }> }
    | { id?: string; email?: string | null }
    | null;

  if (payload && Array.isArray((payload as { users?: unknown }).users)) {
    const users = (payload as { users: Array<{ id?: string; email?: string | null }> }).users;
    const match = users.find((user) => (user.email ?? "").trim().toLowerCase() === email);
    return match?.id?.trim() || null;
  }

  const single = payload as { id?: string; email?: string | null } | null;
  if (single?.id && (single.email ?? "").trim().toLowerCase() === email) {
    return single.id.trim();
  }
  return null;
}

export async function handleSendCandidateSms(
  auth: StaffApiAuthContext,
  workerIdRaw: string,
  body: unknown
): Promise<NextResponse> {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }
  const workerId = idCheck.value;

  const rate = checkCommunicationRateLimit(auth.userId);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many messages sent. Please try again later.",
        retryAfterSec: rate.retryAfterSec,
      },
      { status: 429 }
    );
  }

  let payload: z.infer<typeof sendCandidateSmsSchema>;
  try {
    payload = sendCandidateSmsSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return validationError(e);
    throw e;
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const contact = await resolveWorkerContact(supabase, workerId);
  if (!contact) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (!canAccessWorkerRecord(auth, { id: contact.id, user_id: contact.userId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!contact.phone) {
    return NextResponse.json(
      { error: "This candidate does not have a phone number on file." },
      { status: 400 }
    );
  }

  if (!contact.tenantId) {
    return NextResponse.json({ error: "Candidate tenant is missing" }, { status: 400 });
  }

  let sendResult: Awaited<ReturnType<typeof sendCandidateSms>>;
  try {
    sendResult = await sendCandidateSms({
      to: contact.phone,
      body: payload.body,
    });
  } catch (e) {
    if (e instanceof CommunicationConfigError) return configError(e);
    throw e;
  }

  const row = await recordCandidateCommunication(supabase, {
    tenantId: contact.tenantId,
    workerId: contact.id,
    sentByUserId: auth.devBypass ? null : auth.userId,
    channel: "sms",
    recipient: contact.phone,
    body: payload.body,
    providerMessageId: sendResult.ok ? sendResult.messageId : null,
    status: sendResult.ok ? "sent" : "failed",
    direction: "outbound",
    errorMessage: sendResult.ok ? null : sendResult.error,
  });

  if (!sendResult.ok) {
    return NextResponse.json(
      { error: sendResult.error, record: row },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: sendResult.messageId,
    record: row,
  });
}

export async function handleListCandidateCommunications(
  auth: StaffApiAuthContext,
  workerIdRaw: string
): Promise<NextResponse> {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }
  const workerId = idCheck.value;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const contact = await resolveWorkerContact(supabase, workerId);
  if (!contact) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (!canAccessWorkerRecord(auth, { id: contact.id, user_id: contact.userId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { communications, threads } = await listCandidateCommunicationsWithThreads(
    supabase,
    workerId,
    { email: contact.email, phone: contact.phone }
  );

  return NextResponse.json(
    {
      communications,
      threads,
      conversations: threads,
      contact: {
        name: `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Candidate",
        email: contact.email,
        phone: contact.phone,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
