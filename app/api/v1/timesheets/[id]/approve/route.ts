import { handleTimesheetTransition } from "@/lib/timesheets/transition-handler";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  route: { params: Promise<{ id: string }> },
) {
  return handleTimesheetTransition(request, route, "approve");
}
