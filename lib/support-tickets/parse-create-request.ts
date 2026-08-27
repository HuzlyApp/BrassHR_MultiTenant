import { NextRequest } from "next/server";
import type { SupportTicketPriority } from "@/lib/support-tickets/types";

export type ParsedSupportTicketCreateBody = {
  subject: string;
  description: string;
  category?: string;
  priority?: SupportTicketPriority;
  source?: string;
  /** Worker/applicant id when staff creates on behalf of a worker. */
  applicantId?: string;
  files: File[];
};

function parsePriority(value: string): SupportTicketPriority | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "normal" || normalized === "high" || normalized === "urgent") {
    return normalized;
  }
  return undefined;
}

function collectFiles(form: FormData): File[] {
  const files: File[] = [];
  for (const entry of form.getAll("file")) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }
  for (const entry of form.getAll("files")) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }
  return files;
}

export async function parseSupportTicketCreateBody(
  req: NextRequest
): Promise<ParsedSupportTicketCreateBody> {
  const isFormData = req.headers.get("content-type")?.toLowerCase().includes("multipart/form-data");

  if (isFormData) {
    const form = await req.formData();
    const priorityRaw = String(form.get("priority") ?? "");
    const categoryRaw = String(form.get("category") ?? "").trim();
    const sourceRaw = String(form.get("source") ?? "").trim();

    const applicantIdRaw = String(
      form.get("applicantId") ?? form.get("applicant_id") ?? form.get("workerId") ?? ""
    ).trim();

    return {
      subject: String(form.get("subject") ?? "").trim(),
      description: String(form.get("description") ?? form.get("inquiry") ?? "").trim(),
      category: categoryRaw || undefined,
      priority: parsePriority(priorityRaw),
      source: sourceRaw || undefined,
      applicantId: applicantIdRaw || undefined,
      files: collectFiles(form),
    };
  }

  const body = (await req.json().catch(() => ({}))) as {
    inquiry?: string;
    subject?: string;
    description?: string;
    category?: string;
    priority?: string;
    source?: string;
    applicantId?: string;
    applicant_id?: string;
    workerId?: string;
  };

  const applicantId =
    body.applicantId?.trim() || body.applicant_id?.trim() || body.workerId?.trim() || undefined;

  return {
    subject: body.subject?.trim() ?? "",
    description: (body.description ?? body.inquiry ?? "").trim(),
    category: body.category?.trim() || undefined,
    priority: body.priority ? parsePriority(body.priority) : undefined,
    source: body.source?.trim() || undefined,
    applicantId,
    files: [],
  };
}
