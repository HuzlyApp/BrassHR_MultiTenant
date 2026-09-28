import type { AnalysisMode } from "./schema";
import type { AiVariantKey } from "@/lib/ai-catalog/types";

/** Catalog variant for each AI Match progression step (FS-AI-MATCH-001). */
export function matchProgressionVariantKey(
  mode: AnalysisMode | "submission"
): Extract<AiVariantKey, "quick" | "call_pack" | "follow_up" | "deep" | "submission"> {
  if (mode === "deep") return "deep";
  if (mode === "call_pack") return "call_pack";
  if (mode === "follow_up") return "follow_up";
  if (mode === "submission") return "submission";
  return "quick";
}
