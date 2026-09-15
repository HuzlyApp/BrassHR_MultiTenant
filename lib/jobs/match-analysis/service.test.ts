import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPromptVersion } from "@/lib/ai-catalog/types";
import {
  __setGeminiFetchForTests,
  __setGrokClientForTests,
  generateMatchAnalysis,
  getMatchAnalysisModelName,
} from "./service";

const LEAN_ANALYSIS = {
  recommended_overall_match_score: 82,
  match_category: "GOOD_MATCH",
  recommended_action: "CALL_AND_VERIFY",
  mandatory_requirements: [
    {
      requirement: "Active TX RN license",
      status: "CONFIRMED",
      evidence: "Lists compact RN license.",
    },
  ],
  preferred_requirements: [],
  strengths: ["ICU experience at Memorial."],
  gaps_and_risks: ["Shift preference not listed."],
  resume_authenticity: "Low concern",
  screening_questions: ["Confirm compact license status."],
  items_to_verify: ["Work authorization"],
  blocking_requirements: [],
};

const resolved: ResolvedPromptVersion = {
  promptVersionId: "pv1",
  templateId: "t1",
  featureKey: "candidate_match",
  variantKey: "default",
  requestedIndustryKey: "healthcare",
  resolvedVerticalKey: "healthcare",
  contentHash: "hash",
  systemPrompt: "You are an analyst.",
  userPromptTemplate: "Job:\n{{job_description}}\n\nResume:\n{{candidate_resume}}",
  responseSchema: {},
  modelConfig: {},
  status: "published",
  versionNumber: 1,
  source: "published_master",
  fallbackApplied: false,
};

const input = {
  jobId: "job-1",
  jobTitle: "ICU RN",
  structured: {
    mandatoryRequirements: ["Active TX RN license"],
    preferredRequirements: [],
    requiredLicenses: [],
    requiredCertifications: [],
    educationRequirements: [],
  },
  fullJobDescription: "ICU RN in Austin, TX",
  resumeText: "Jane Doe RN with 3 years ICU at Memorial.",
};

afterEach(() => {
  __setGeminiFetchForTests(null);
  __setGrokClientForTests(null);
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MATCH_MODEL;
  delete process.env.XAI_MATCH_MODEL;
});

describe("getMatchAnalysisModelName", () => {
  it("defaults to Gemini", () => {
    expect(getMatchAnalysisModelName()).toBe("gemini-2.5-flash-lite");
    expect(getMatchAnalysisModelName("gemini")).toBe("gemini-2.5-flash-lite");
  });

  it("returns the Grok model when Grok is selected", () => {
    expect(getMatchAnalysisModelName("grok")).toBe("grok-4-fast");
  });
});

describe("generateMatchAnalysis", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  it("calls Gemini by default", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("/models/gemini-2.5-flash-lite:generateContent");
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(LEAN_ANALYSIS) }] } }],
        }),
      };
    });
    __setGeminiFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await generateMatchAnalysis(input, resolved);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.model).toBe("gemini-2.5-flash-lite");
    expect(result.analysis.mandatory_requirements).toHaveLength(1);
    expect(result.repaired).toBe(false);
  });

  it("ignores a Grok catalog model when Gemini is selected", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("/models/gemini-2.5-flash-lite:generateContent");
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(LEAN_ANALYSIS) }] } }],
        }),
      };
    });
    __setGeminiFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await generateMatchAnalysis(
      input,
      { ...resolved, modelConfig: { model: "grok-4-fast" } },
      "gemini"
    );

    expect(result.model).toBe("gemini-2.5-flash-lite");
  });

  it("calls Grok when Grok is selected", async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify(LEAN_ANALYSIS),
    }));
    __setGrokClientForTests({
      responses: { create },
    } as never);

    const result = await generateMatchAnalysis(input, resolved, "grok");

    expect(create).toHaveBeenCalledOnce();
    expect(result.model).toBe("grok-4-fast");
    expect(result.analysis.mandatory_requirements).toHaveLength(1);
  });
});
