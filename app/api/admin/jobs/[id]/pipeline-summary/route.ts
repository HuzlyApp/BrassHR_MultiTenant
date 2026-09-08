import { getJobPipelineSummaryResponse } from "@/lib/jobs/pipeline-summary-api";

export const runtime = "nodejs";

/**
 * FSD-JOB-UX-001: GET /api/requisitions/{id}/pipeline-summary
 * Admin path:
 *   GET /api/admin/jobs/{id}/pipeline-summary
 *
 * Response:
 *   { all, intake, screening, interview, submission, selected, onboarding, closed, show_submission }
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return getJobPipelineSummaryResponse(context);
}
