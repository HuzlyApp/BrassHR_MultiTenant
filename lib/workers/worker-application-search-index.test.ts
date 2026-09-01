import { describe, expect, it } from "vitest";
import { matchesCandidateListSearch } from "@/lib/admin/candidate-list-search";
import {
  buildApplicationSearchText,
  indexApplicationSearchRows,
  isApplicationIncludedInAllTabSearch,
} from "@/lib/workers/worker-application-search-index";

describe("worker application search index", () => {
  const statusOptions = [
    { id: "status-new", systemKey: "new" },
    { id: "status-archived", systemKey: "archived" },
  ];

  it("includes withdrawn applications and excludes archived (applications All tab parity)", () => {
    const rows = [
      {
        worker_id: "worker-1",
        id: "app-withdrawn",
        job_requisition_id: "job-1",
        status: "withdrawn",
        job_requisitions: {
          public_title: "Mainframe Developer – COBOL | CICS",
        },
      },
      {
        worker_id: "worker-1",
        id: "app-archived",
        job_requisition_id: "job-2",
        status: "archived",
        status_id: "status-archived",
        application_statuses: { id: "status-archived", system_key: "archived" },
        job_requisitions: {
          public_title: "Legacy COBOL Role",
        },
      },
    ];

    expect(isApplicationIncludedInAllTabSearch(rows[0], statusOptions)).toBe(true);
    expect(isApplicationIncludedInAllTabSearch(rows[1], statusOptions)).toBe(false);

    const indexed = indexApplicationSearchRows(rows, statusOptions);
    expect(indexed.get("worker-1")).toContain("COBOL");
    expect(indexed.get("worker-1")).not.toContain("Legacy COBOL Role");
  });

  it("indexes source_job_title when public_title is empty", () => {
    const indexed = indexApplicationSearchRows(
      [
        {
          worker_id: "worker-2",
          id: "app-1",
          job_requisition_id: "job-3",
          status: "new",
          job_requisitions: {
            public_title: null,
            source_job_title: "Senior COBOL Programmer",
          },
        },
      ],
      statusOptions
    );

    expect(indexed.get("worker-2")).toContain("Senior COBOL Programmer");
  });
});

describe("matchesCandidateListSearch applicationSearchText", () => {
  const base = {
    id: "worker-1",
    name: "Alex Doe",
    email: "alex@example.com",
    phone: "",
    role: "N/A",
  };

  it("matches COBOL from applicationSearchText on withdrawn applications", () => {
    expect(
      matchesCandidateListSearch(
        {
          ...base,
          applicationSearchText: buildApplicationSearchText([
            "Mainframe Developer – COBOL | CICS | DB2",
          ]),
        },
        "cobol"
      )
    ).toBe(true);
  });
});
