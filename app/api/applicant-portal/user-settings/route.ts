import { NextRequest, NextResponse } from "next/server";
import { formatApiError } from "@/lib/api/format-api-error";
import { applicantDisplayName } from "@/lib/applicant-portal";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { createSignedPortalFileUrl } from "@/lib/applicant-portal/upload";
import { isPersonNameTooLong, personNameTooLongMessage } from "@/lib/person-name";
import { formatPhoneNumber, normalizePhoneInput } from "@/lib/phone";
import { EASTERN_TIME_ZONE } from "@/lib/datetime/eastern";

export const runtime = "nodejs";

const ABOUT_ME_MAX_LENGTH = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LANGUAGE_VALUES = new Set(["en-US", "es-US"]);
const DATE_FORMAT_VALUES = new Set(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]);
const TIME_FORMAT_VALUES = new Set(["12h", "24h"]);

type PortalPreferences = {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
};

const DEFAULT_PREFERENCES: PortalPreferences = {
  language: "en-US",
  timezone: EASTERN_TIME_ZONE,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

type WorkerSettingsRow = {
  id: string;
  tenant_id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  job_role: string | null;
  department_id: string | null;
  city: string | null;
  state: string | null;
  about_me: string | null;
  profile_photo: string | null;
  portal_preferences: unknown;
  status: string | null;
};

function normalizePreferences(value: unknown): PortalPreferences {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const language =
    typeof raw.language === "string" && LANGUAGE_VALUES.has(raw.language)
      ? raw.language
      : DEFAULT_PREFERENCES.language;
  const timezone =
    typeof raw.timezone === "string" && raw.timezone.trim()
      ? raw.timezone.trim()
      : DEFAULT_PREFERENCES.timezone;
  const dateFormat =
    typeof raw.dateFormat === "string" && DATE_FORMAT_VALUES.has(raw.dateFormat)
      ? raw.dateFormat
      : DEFAULT_PREFERENCES.dateFormat;
  const timeFormat =
    typeof raw.timeFormat === "string" && TIME_FORMAT_VALUES.has(raw.timeFormat)
      ? raw.timeFormat
      : DEFAULT_PREFERENCES.timeFormat;
  return { language, timezone, dateFormat, timeFormat };
}

function locationLabel(city: string | null, state: string | null): string {
  return [city?.trim(), state?.trim()].filter(Boolean).join(", ");
}

function parseLocation(value: string): { city: string | null; state: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { city: null, state: null };
  const comma = trimmed.lastIndexOf(",");
  if (comma === -1) return { city: trimmed, state: null };
  const city = trimmed.slice(0, comma).trim();
  const state = trimmed.slice(comma + 1).trim();
  return {
    city: city || null,
    state: state || null,
  };
}

function employeeIdLabel(workerId: string): string {
  const compact = workerId.replace(/-/g, "").slice(-4).toUpperCase();
  return compact ? `EMP-${compact}` : "—";
}

async function resolvePhotoUrl(
  supabase: Parameters<typeof createSignedPortalFileUrl>[0],
  profilePhoto: string | null
): Promise<string | null> {
  const value = profilePhoto?.trim() ?? "";
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return createSignedPortalFileUrl(supabase, value);
}

async function serializeSettings(
  supabase: Parameters<typeof createSignedPortalFileUrl>[0],
  worker: WorkerSettingsRow,
  departments: Array<{ id: string; name: string }>
) {
  const profilePhotoUrl = await resolvePhotoUrl(supabase, worker.profile_photo);
  return {
    profile: {
      firstName: worker.first_name ?? "",
      lastName: worker.last_name ?? "",
      preferredName: worker.preferred_name ?? "",
      email: worker.email ?? "",
      phone: worker.phone ? formatPhoneNumber(worker.phone) : "",
      birthdate: worker.date_of_birth ? String(worker.date_of_birth).slice(0, 10) : "",
      jobTitle: worker.job_role ?? "",
      departmentId: worker.department_id ?? "",
      employeeId: employeeIdLabel(worker.id),
      location: locationLabel(worker.city, worker.state),
      bio: worker.about_me ?? "",
      profilePhotoUrl,
      displayName: applicantDisplayName({
        id: worker.id,
        tenant_id: worker.tenant_id,
        user_id: null,
        email: worker.email,
        first_name: worker.first_name,
        last_name: worker.last_name,
        status: worker.status,
        applicant_password_set_at: null,
      }),
    },
    preferences: normalizePreferences(worker.portal_preferences),
    departments,
  };
}

const WORKER_SETTINGS_SELECT =
  "id, tenant_id, first_name, last_name, preferred_name, email, phone, date_of_birth, job_role, department_id, city, state, about_me, profile_photo, portal_preferences, status";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const [{ data, error }, departmentsResult] = await Promise.all([
      auth.supabase
        .from("worker")
        .select(WORKER_SETTINGS_SELECT)
        .eq("id", auth.applicant.id)
        .maybeSingle(),
      auth.supabase
        .from("departments")
        .select("id, name")
        .eq("tenant_id", auth.applicant.tenant_id)
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (departmentsResult.error) throw departmentsResult.error;

    const departments = ((departmentsResult.data ?? []) as Array<{ id: string; name: string }>).map(
      (row) => ({ id: row.id, name: row.name })
    );

    return NextResponse.json(await serializeSettings(auth.supabase, data as WorkerSettingsRow, departments));
  } catch (err) {
    console.error("[applicant-portal/user-settings:get]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const section = typeof body.section === "string" ? body.section : "profile";

    if (section === "deactivate") {
      const { error } = await auth.supabase
        .from("worker")
        .update({
          status: "inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("id", auth.applicant.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, deactivated: true });
    }

    if (section === "preferences") {
      const preferences = normalizePreferences({
        language: body.language,
        timezone: body.timezone,
        dateFormat: body.dateFormat,
        timeFormat: body.timeFormat,
      });

      const { data, error } = await auth.supabase
        .from("worker")
        .update({
          portal_preferences: preferences,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auth.applicant.id)
        .select(WORKER_SETTINGS_SELECT)
        .single();
      if (error) throw error;

      const { data: departmentsData } = await auth.supabase
        .from("departments")
        .select("id, name")
        .eq("tenant_id", auth.applicant.tenant_id)
        .eq("is_active", true)
        .order("name", { ascending: true });

      return NextResponse.json({
        ok: true,
        ...(await serializeSettings(
          auth.supabase,
          data as WorkerSettingsRow,
          ((departmentsData ?? []) as Array<{ id: string; name: string }>).map((row) => ({
            id: row.id,
            name: row.name,
          }))
        )),
      });
    }

    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const preferredName =
      typeof body.preferredName === "string" ? body.preferredName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const birthdate = typeof body.birthdate === "string" ? body.birthdate.trim() : "";
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
    const departmentId =
      typeof body.departmentId === "string" && body.departmentId.trim()
        ? body.departmentId.trim()
        : null;
    const location = typeof body.location === "string" ? body.location : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";

    const fieldErrors: Record<string, string> = {};
    if (!firstName) fieldErrors.firstName = "First name is required.";
    else if (isPersonNameTooLong(firstName)) {
      fieldErrors.firstName = personNameTooLongMessage("First name");
    }
    if (!lastName) fieldErrors.lastName = "Last name is required.";
    else if (isPersonNameTooLong(lastName)) {
      fieldErrors.lastName = personNameTooLongMessage("Last name");
    }
    if (preferredName && isPersonNameTooLong(preferredName)) {
      fieldErrors.preferredName = personNameTooLongMessage("Preferred name");
    }
    if (!email) fieldErrors.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
    const phoneDigits = normalizePhoneInput(phoneRaw);
    if (!phoneDigits) fieldErrors.phone = "Phone number is required.";
    else if (phoneDigits.length !== 10) fieldErrors.phone = "Enter a valid 10-digit phone number.";
    if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      fieldErrors.birthdate = "Enter a valid birthdate.";
    }
    if (bio.length > ABOUT_ME_MAX_LENGTH) {
      fieldErrors.bio = `Bio must be ${ABOUT_ME_MAX_LENGTH} characters or fewer.`;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
    }

    if (departmentId) {
      const { data: department, error: departmentError } = await auth.supabase
        .from("departments")
        .select("id")
        .eq("id", departmentId)
        .eq("tenant_id", auth.applicant.tenant_id)
        .eq("is_active", true)
        .maybeSingle();
      if (departmentError) throw departmentError;
      if (!department) {
        return NextResponse.json(
          { error: "Validation failed", fieldErrors: { departmentId: "Select a valid department." } },
          { status: 400 }
        );
      }
    }

    const { city, state } = parseLocation(location);

    const { data, error } = await auth.supabase
      .from("worker")
      .update({
        first_name: firstName,
        last_name: lastName,
        preferred_name: preferredName || null,
        email,
        phone: formatPhoneNumber(phoneDigits),
        date_of_birth: birthdate || null,
        job_role: jobTitle || null,
        department_id: departmentId,
        city,
        state,
        about_me: bio || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.applicant.id)
      .select(WORKER_SETTINGS_SELECT)
      .single();
    if (error) throw error;

    const { data: departmentsData } = await auth.supabase
      .from("departments")
      .select("id, name")
      .eq("tenant_id", auth.applicant.tenant_id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    return NextResponse.json({
      ok: true,
      ...(await serializeSettings(
        auth.supabase,
        data as WorkerSettingsRow,
        ((departmentsData ?? []) as Array<{ id: string; name: string }>).map((row) => ({
          id: row.id,
          name: row.name,
        }))
      )),
    });
  } catch (err) {
    console.error("[applicant-portal/user-settings:patch]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
