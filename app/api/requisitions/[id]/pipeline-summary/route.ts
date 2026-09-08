import { getJobPipelineSummaryResponse } from "@/lib/jobs/pipeline-summary-api";

export const runtime = "nodejs";

/** FSD alias for GET /api/requisitions/{id}/pipeline-summary */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return getJobPipelineSummaryResponse(context);
}
