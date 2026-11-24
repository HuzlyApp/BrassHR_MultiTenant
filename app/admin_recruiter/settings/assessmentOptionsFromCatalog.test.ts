import { describe, expect, it } from "vitest";
import { assessmentOptionsFromCatalog } from "@/app/admin_recruiter/settings/assessment-options-from-catalog";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";
import {
  DEFAULT_SKILL_ASSESSMENT_SCORING,
  type SkillAssessmentCatalog,
} from "@/lib/skill-assessment/types";

describe("assessmentOptionsFromCatalog", () => {
  it("includes shared default categories", () => {
    const { options } = assessmentOptionsFromCatalog(createDefaultSkillAssessmentCatalog());
    expect(options.length).toBeGreaterThanOrEqual(5);
    expect(options.some((row) => row.name === "Basic Patient Care & Hygiene")).toBe(true);
  });

  it("includes custom profession-bound categories alongside shared templates", () => {
    const base = createDefaultSkillAssessmentCatalog();
    const catalog: SkillAssessmentCatalog = {
      ...base,
      categories: [
        ...base.categories,
        {
          id: "custom-cat-1",
          name: "Frontend Skills",
          description: "",
          instructions: null,
          slug: "frontend-skills",
          sortOrder: 99,
          isActive: true,
          professionId: "prof-123",
          questions: [],
        },
      ],
    };
    const { options, labelsByProfession } = assessmentOptionsFromCatalog(catalog);
    expect(options.some((row) => row.name === "Frontend Skills")).toBe(true);
    expect(options.some((row) => row.name === "Basic Patient Care & Hygiene")).toBe(true);
    expect(labelsByProfession["prof-123"]).toBe("Frontend Skills");
  });

  it("prefers shared template id when the same name exists as profession-bound", () => {
    const catalog: SkillAssessmentCatalog = {
      enabled: true,
      allowSkip: true,
      scoring: { ...DEFAULT_SKILL_ASSESSMENT_SCORING },
      professionProfiles: {},
      categories: [
        {
          id: "bound-1",
          name: "Safety Basics",
          description: "",
          instructions: null,
          slug: "safety-basics",
          sortOrder: 1,
          isActive: true,
          professionId: "prof-1",
          questions: [],
        },
        {
          id: "shared-1",
          name: "Safety Basics",
          description: "",
          instructions: null,
          slug: "safety-basics",
          sortOrder: 1,
          isActive: true,
          professionId: null,
          questions: [],
        },
      ],
    };
    const { options } = assessmentOptionsFromCatalog(catalog);
    expect(options).toEqual([{ id: "shared-1", name: "Safety Basics" }]);
  });
});
