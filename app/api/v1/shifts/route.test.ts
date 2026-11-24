import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scheduling/api-context", () => ({ requireSchedulingContext: vi.fn(), schedulingError: vi.fn(), invalidSchedule: vi.fn() }));
vi.mock("@/lib/scheduling/v1-service", () => ({ createScheduleShift: vi.fn() }));
import { GET } from "./route";

describe("GET /api/v1/shifts", () => {
  it("returns a readable JSON method error with the supported method and read endpoint", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(body.error).toBe("Method not allowed");
    expect(body.message).toContain("GET /api/v1/schedules");
    expect(body.message).toContain("date_from");
  });
});
