export const ASSESSMENT_LIST_HREF = "/admin_recruiter/settings/assessment";

export function assessmentDetailHref(professionId: string): string {
  return `${ASSESSMENT_LIST_HREF}/${encodeURIComponent(professionId)}`;
}
