import { describe, expect, it } from "vitest";
import { applyUiToJob, defaultJobFormUiState } from "./job-form-shared";
import type { JobRequisitionInput } from "@/lib/jobs/types";

describe("workflow preview uses UI location fields (BUG-153)", () => {
  it("applyUiToJob copies work location type from ui onto the preview job", () => {
    const job = {
      employmentType: "W2",
      professionId: "prof-1",
      jobLocationType: "",
      yearsOfExperience: "",
    } as JobRequisitionInput;
    const ui = defaultJobFormUiState();
    ui.jobLocationType = "On-site";
    ui.yearsOfExperience = "2";

    const preview = applyUiToJob(job, ui);
    expect(preview.jobLocationType).toBe("On-site");
    expect(preview.yearsOfExperience).toBe("2");
    expect(job.jobLocationType).toBe("");
  });
});
