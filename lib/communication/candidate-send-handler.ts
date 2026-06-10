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

  return NextResponse.json({
    ok: true,
    messageId: sendResult.messageId,
    record: row,
  });
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
