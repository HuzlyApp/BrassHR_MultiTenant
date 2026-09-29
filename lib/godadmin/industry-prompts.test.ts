import { describe, expect, it } from "vitest";
import {
  buildIndustryPromptListItems,
  classifyPackConfigStatus,
  configStatusLabel,
  parseIndustryPromptSavePayload,
  validateIndustryPromptBody,
  versionEventLabel,
} from "@/lib/godadmin/industry-prompts";
import { formatEastern } from "@/lib/datetime/eastern";

describe("classifyPackConfigStatus", () => {
  it("marks full dedicated coverage", () => {
    expect(
      classifyPackConfigStatus({
        packKey: "healthcare",
        dedicatedCurrentVariantCount: 5,
        globalHasAnyCurrent: true,
      })
    ).toBe("dedicated");
  });

  it("marks partial dedicated coverage", () => {
    expect(
      classifyPackConfigStatus({
        packKey: "healthcare",
        dedicatedCurrentVariantCount: 2,
        globalHasAnyCurrent: true,
      })
    ).toBe("partial");
  });

  it("falls back to global when pack has none", () => {
    expect(
      classifyPackConfigStatus({
        packKey: "healthcare",
        dedicatedCurrentVariantCount: 0,
        globalHasAnyCurrent: true,
      })
    ).toBe("fallback_global");
  });

  it("marks missing when neither pack nor global exists", () => {
    expect(
      classifyPackConfigStatus({
        packKey: "healthcare",
        dedicatedCurrentVariantCount: 0,
        globalHasAnyCurrent: false,
      })
    ).toBe("missing");
  });
});

describe("buildIndustryPromptListItems", () => {
  it("reports industries sharing a pack and fallback status", () => {
    const map = new Map([
      ["global:quick", { versionNumber: 3, publishedAt: "2026-09-29T12:00:00.000Z" }],
      ["technology:quick", { versionNumber: 2, publishedAt: "2026-09-28T12:00:00.000Z" }],
    ]);
    const rows = buildIndustryPromptListItems(map);
    const tech = rows.find((row) => row.industryKey === "technology");
    const allied = rows.find((row) => row.industryKey === "allied_health");
    expect(tech?.configStatus).toBe("partial");
    expect(allied?.configStatus).toBe("fallback_global");
    expect(allied?.aiPackKey).toBe("healthcare");
    expect(configStatusLabel("fallback_global")).toBe("Uses Global fallback");
  });
});

describe("validateIndustryPromptBody", () => {
  it("rejects blank prompts", () => {
    const result = validateIndustryPromptBody({
      systemPrompt: "   ",
      userPromptTemplate: "",
      variantKey: "quick",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => /System prompt/.test(error))).toBe(true);
    expect(result.errors.some((error) => /User prompt/.test(error))).toBe(true);
  });

  it("rejects unknown placeholders without rewriting known ones", () => {
    const result = validateIndustryPromptBody({
      systemPrompt: "Assess {{job_title}} using {{totally_fake_var}}",
      userPromptTemplate: "Resume:\n{{candidate_resume}}",
      variantKey: "quick",
    });
    expect(result.ok).toBe(false);
    expect(result.unknownVariables).toEqual(["totally_fake_var"]);
    expect(result.variablesUsed).toContain("job_title");
    expect(result.variablesUsed).toContain("candidate_resume");
  });

  it("accepts supported quick-match variables", () => {
    const result = validateIndustryPromptBody({
      systemPrompt: "Score {{job_title}} for {{msp_or_client}} carefully with enough guidance text.",
      userPromptTemplate: "{{job_description}}\n{{candidate_resume}}",
      variantKey: "quick",
    });
    expect(result.ok).toBe(true);
    expect(result.unknownVariables).toEqual([]);
  });
});

describe("parseIndustryPromptSavePayload", () => {
  it("requires change note and valid industry/variant", () => {
    expect(
      parseIndustryPromptSavePayload({
        industryKey: "technology",
        variantKey: "quick",
        systemPrompt: "Enough system prompt text for validation checks here.",
        userPromptTemplate: "{{candidate_resume}}",
      })
    ).toEqual({ error: "A change note is required." });
  });

  it("parses a valid save payload", () => {
    const parsed = parseIndustryPromptSavePayload({
      industryKey: "technology",
      variantKey: "quick",
      systemPrompt: "Enough system prompt text for validation checks here.",
      userPromptTemplate: "{{candidate_resume}}",
      changeNote: "Tighten scoring",
    });
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.industryKey).toBe("technology");
    expect(parsed.changeNote).toBe("Tighten scoring");
  });
});

describe("versionEventLabel", () => {
  it("labels restores, activations, and drafts", () => {
    expect(
      versionEventLabel({
        status: "published",
        isCurrent: true,
        sourceVersionId: "abc",
        changeReason: "Restored from version 2",
      })
    ).toBe("restored");
    expect(
      versionEventLabel({
        status: "published",
        isCurrent: true,
        sourceVersionId: null,
        changeReason: "Initial publish",
      })
    ).toBe("activated");
    expect(
      versionEventLabel({
        status: "draft",
        isCurrent: false,
        sourceVersionId: null,
        changeReason: null,
      })
    ).toBe("draft");
  });
});

describe("industry prompt timestamps use Eastern Time", () => {
  it("formats activation times in America/New_York", () => {
    const label = formatEastern("2026-09-29T16:00:00.000Z", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    expect(label).toBe("Sep 29, 2026, 12:00 PM");
  });
});
