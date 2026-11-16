import { handleWorkerRequestReview } from "@/lib/workers/review-request-handler";
export const runtime = "nodejs";
export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  return handleWorkerRequestReview(request, route, "rejected");
}
