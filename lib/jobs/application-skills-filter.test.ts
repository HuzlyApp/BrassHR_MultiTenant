import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSkillsFilterParam, filterWorkerIdsMatchingSkills } from "./application-skills-filter";

describe("parseSkillsFilterParam", () => {
  it("returns empty for blank input", () => {
    expect(parseSkillsFilterParam(null)).toEqual([]);
    expect(parseSkillsFilterParam("")).toEqual([]);
    expect(parseSkillsFilterParam("   ")).toEqual([]);
  });

  it("splits, trims, and dedupes case-insensitively", () => {
    expect(parseSkillsFilterParam("ICU, BLS, icu, ACLS")).toEqual(["ICU", "BLS", "ACLS"]);
  });

  it("caps at 16 skills", () => {
    const raw = Array.from({ length: 20 }, (_, i) => `Skill${i + 1}`).join(",");
    expect(parseSkillsFilterParam(raw)).toHaveLength(16);
  });
});

describe("filterWorkerIdsMatchingSkills", () => {
  it("returns all workers when skills list is empty", async () => {
    const matched = await filterWorkerIdsMatchingSkills(
      {} as SupabaseClient,
      "tenant-1",
      ["w1", "w2"],
      []
    );
    expect([...matched].sort()).toEqual(["w1", "w2"]);
  });

  it("matches workers by resume text and profile skills (AND)", async () => {
    const resumesByWorker: Record<string, string> = {
      w1: "Registered nurse with ICU and BLS certification",
      w2: "Med-surg nurse with BLS only",
      w3: "OR circulating nurse",
    };
    const profileByWorker: Record<string, string[]> = {
      w1: [],
      w2: ["ACLS"],
      w3: ["ICU", "BLS"],
    };

    const supabase = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  in(_column: string, chunk: string[]) {
                    if (table === "worker_resumes") {
                      return {
                        is() {
                          return {
                            order: async () => ({
                              data: chunk.map((worker_id) => ({
                                worker_id,
                                extracted_text: resumesByWorker[worker_id] ?? "",
                                uploaded_at: "2026-01-01",
                              })),
                              error: null,
                            }),
                          };
                        },
                      };
                    }
                    return Promise.resolve({
                      data: chunk.flatMap((worker_id) =>
                        (profileByWorker[worker_id] ?? []).map((skill_name) => ({
                          worker_id,
                          skill_name,
                        }))
                      ),
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const matched = await filterWorkerIdsMatchingSkills(supabase, "tenant-1", ["w1", "w2", "w3", "w4"], [
      "ICU",
      "BLS",
    ]);
    expect([...matched].sort()).toEqual(["w1", "w3"]);
  });
});
