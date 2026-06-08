/** xAI models that accept image input via chat completions (image → text). */
export const XAI_VISION_MODEL =
  process.env.DOCUMENT_VERIFY_MODEL?.trim() || "grok-4.3"

export const XAI_VISION_MODEL_FALLBACKS = [
  "grok-4.3",
  "grok-4.20-0309-non-reasoning",
  "grok-4.20-0309-reasoning",
  "grok-build-0.1",
] as const
