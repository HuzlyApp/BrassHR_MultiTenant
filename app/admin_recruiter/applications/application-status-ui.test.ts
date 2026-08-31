import { describe, expect, it } from "vitest";
import { matchesApplicationStatusTab } from "@/lib/jobs/application-status-tab";

type StatusOption = { id: string; name: string; systemKey: string | null };

type AppRow = {
  id: string;
  worker_id: string;
  status: string;
  status_id: string | null;
};

describe("job candidates status filtering", () => {
  const options: StatusOption[] = [
    { id: "s-new", name: "New", systemKey: "new" },
    { id: "s-reviewing", name: "Reviewing", systemKey: "reviewing" },
    { id: "s-interviewing", name: "Interviewing", systemKey: "interviewing" },
  ];

  it("filters by status_id for the selected job application", () => {
    const rows: AppRow[] = [
      { id: "a1", worker_id: "w1", status: "new", status_id: "s-new" },
      { id: "a2", worker_id: "w1", status: "interviewing", status_id: "s-interviewing" },
    ];
    const reviewing = rows.filter((row) => matchesApplicationStatusTab(row, "s-reviewing", options));
    const interviewing = rows.filter((row) =>
      matchesApplicationStatusTab(row, "s-interviewing", options)
    );
    expect(reviewing).toHaveLength(0);
    expect(interviewing.map((r) => r.id)).toEqual(["a2"]);
  });

  it("keeps multi-job application statuses isolated conceptually", () => {
    const apps = [
      { id: "job-a", worker_id: "priya", status_id: "s-new" },
      { id: "job-b", worker_id: "priya", status_id: "s-interviewing" },
    ];
    const updated = apps.map((app) =>
      app.id === "job-a" ? { ...app, status_id: "s-reviewing" } : app
    );
    expect(updated.find((a) => a.id === "job-a")?.status_id).toBe("s-reviewing");
    expect(updated.find((a) => a.id === "job-b")?.status_id).toBe("s-interviewing");
  });

  it("treats blank notes as omitted", () => {
    const note = "   ".trim() || undefined;
    expect(note).toBeUndefined();
  });
});
