import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { generateJobDescriptionWithGrok } from "@/lib/jobs/generate-job-description";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TONES = new Set(["Professional", "Friendly", "Formal", "Conversational"]);

function asString(value: unknown, max = 4000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asStringArray(value: unknown, maxItems = 20, maxLen = 80): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, maxLen);
    if (!trimmed) continue;
    if (!out.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      out.push(trimmed);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const limited = await enforceRateLimit(req, {
    namespace: "generate-job-description",
    key: `${auth.userId}:${getClientIp(req)}`,
    limit: Number(process.env.RATE_LIMIT_AI_PER_HOUR ?? 20),
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (limited) return limited;

  if (!(process.env.XAI_API_KEY || process.env.GROK_API_KEY)?.trim()) {
    return NextResponse.json(
      { error: "AI is not configured. Add XAI_API_KEY to the server environment." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roleAbout = asString(body.roleAbout, 2500);
  const toneRaw = asString(body.tone, 40) || "Professional";
  const tone = ALLOWED_TONES.has(toneRaw) ? toneRaw : "Professional";
  const focusAreas = asStringArray(body.focusAreas, 5, 80);
  const useJobPostFields = body.useJobPostFields === true;
  const benefits = asStringArray(body.benefits, 40, 120);

  const jobTitle = asString(body.jobTitle, 160);
  const professionName = asString(body.professionName, 120);
  const specialtyName = asString(body.specialtyName, 120);
  const location = asString(body.location, 160);

  const hasFormAnchor =
    useJobPostFields && Boolean(jobTitle || professionName || specialtyName || location);

  if (roleAbout.length < 12 && !hasFormAnchor) {
    return NextResponse.json(
      {
        error: useJobPostFields
          ? "Fill more job post fields on previous steps, or describe the primary role."
          : "Please describe the primary role in a bit more detail (at least a short sentence).",
      },
      { status: 400 }
    );
  }

  try {
    const result = await generateJobDescriptionWithGrok({
      roleAbout,
      tone,
      focusAreas,
      useJobPostFields,
      jobTitle,
      professionName,
      specialtyName,
      employmentType: asString(body.employmentType, 40),
      location,
      locationType: asString(body.locationType, 80),
      yearsOfExperience: asString(body.yearsOfExperience, 40),
      benefits,
      compensationType: asString(body.compensationType, 40),
      currency: asString(body.currency, 60),
      showPayBy: asString(body.showPayBy, 40),
      payRatePeriod: asString(body.payRatePeriod, 40),
      payRateMin: asOptionalNumber(body.payRateMin),
      payRateMax: asOptionalNumber(body.payRateMax),
      duration: asString(body.duration, 40),
      shiftType: asString(body.shiftType, 80),
      facility: asString(body.facility, 120),
      department: asString(body.department, 120),
      requiredCredentials: asString(body.requiredCredentials, 500),
      specialRequirements: asString(body.specialRequirements, 500),
      numberOfPositions: asOptionalNumber(body.numberOfPositions),
      applicationDeadline: asString(body.applicationDeadline, 40),
    });

    return NextResponse.json({
      descriptionHtml: result.descriptionHtml,
      responsibilitiesHtml: result.responsibilitiesHtml,
      qualificationsHtml: result.qualificationsHtml,
      benefitsHtml: result.benefitsHtml,
      combinedHtml: result.combinedHtml,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to generate job description.";
    const status = /not configured/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
