import { describe, expect, it } from "vitest";
import { collapseRepeatedProfileViews } from "./humanize-activity-action";
describe("candidate history profile view noise", () => {
  it("collapses repeated reads within one minute without removing meaningful actions or changing audit data", () => {
    const rows = [
      { action: "worker.profile.view", created_at: "2026-11-26T12:00:59Z" },
      { action: "worker.profile.view", created_at: "2026-11-26T12:00:01Z" },
      { action: "worker.status.change", created_at: "2026-11-26T12:00:01Z" },
      { action: "worker.profile.view", created_at: "2026-11-26T11:59:59Z" },
    ];
    expect(collapseRepeatedProfileViews(rows)).toEqual([rows[0], rows[2], rows[3]]);
    expect(rows).toHaveLength(4);
  });
});
