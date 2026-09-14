import { describe, expect, it } from "vitest";
import {
  embeddedRelationName,
  matchProfessionIdByName,
  professionCodeFromName,
  professionInputValue,
} from "@/lib/jobs/profession-text";

describe("profession text helpers", () => {
  it("slugs typed names into profession codes", () => {
    expect(professionCodeFromName("Software Engineer")).toBe("SOFTWARE_ENGINEER");
    expect(professionCodeFromName("  IT Specialist  ")).toBe("IT_SPECIALIST");
    expect(professionCodeFromName("***")).toBe("CUSTOM");
  });

  it("matches catalog professions by name, ignoring case and extra spaces", () => {
    const professions = [
      { id: "rn", name: "Registered Nurse" },
      { id: "it", name: "IT Specialist" },
    ];
    expect(matchProfessionIdByName(professions, "registered nurse")).toBe("rn");
    expect(matchProfessionIdByName(professions, "  IT Specialist ")).toBe("it");
    expect(matchProfessionIdByName(professions, "Nursing")).toBeNull();
    expect(matchProfessionIdByName(professions, "")).toBeNull();
  });

  it("prefers typed profession text over the catalog id", () => {
    const professions = [{ id: "rn", name: "Registered Nurse" }];
    expect(professionInputValue({ profession: "Software Engineer", professionId: "rn" }, professions)).toBe(
      "Software Engineer"
    );
    expect(professionInputValue({ professionId: "rn" }, professions)).toBe("Registered Nurse");
    expect(professionInputValue({ profession: "", professionId: "rn" }, professions)).toBe("");
  });

  it("reads embedded profession names from supabase joins", () => {
    expect(embeddedRelationName({ name: "Registered Nurse" })).toBe("Registered Nurse");
    expect(embeddedRelationName([{ name: "Allied Health" }])).toBe("Allied Health");
    expect(embeddedRelationName(null)).toBe("");
  });
});
