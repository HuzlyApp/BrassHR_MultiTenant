export type ChecklistSectionId =
  | "claimed"
  | "screening"
  | "compliance"
  | "facility_req"
  | "new_hire"
  | "final";

const CHECKLIST_SECTION_DETAIL_SLUG: Record<ChecklistSectionId, string> = {
  claimed: "facility-assignments",
  screening: "activities",
  compliance: "attachments",
  facility_req: "authorization",
  new_hire: "agreement",
  final: "final-approval",
};

export function isChecklistSectionId(value: string): value is ChecklistSectionId {
  return value in CHECKLIST_SECTION_DETAIL_SLUG;
}

export function checklistSectionDetailHref(
  sectionId: string,
  applicantId: string
): string | null {
  if (!applicantId.trim() || !isChecklistSectionId(sectionId)) return null;
  const slug = CHECKLIST_SECTION_DETAIL_SLUG[sectionId];
  return `/admin_recruiter/new/${slug}/${encodeURIComponent(applicantId)}`;
}
