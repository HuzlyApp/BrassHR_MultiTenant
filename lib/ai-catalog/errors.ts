export const PROMPT_NOT_CONFIGURED = "PROMPT_NOT_CONFIGURED" as const;
export const PROMPT_VALIDATION_FAILED = "PROMPT_VALIDATION_FAILED" as const;
export const PROMPT_RENDER_FAILED = "PROMPT_RENDER_FAILED" as const;

export class PromptNotConfiguredError extends Error {
  readonly code = PROMPT_NOT_CONFIGURED;
  readonly status = 422;
  constructor(
    message = "No published AI prompt is configured for this feature, variant, and industry."
  ) {
    super(message);
    this.name = "PromptNotConfiguredError";
  }

  toJSON() {
    return { error: this.code, message: this.message };
  }
}

export class PromptValidationError extends Error {
  readonly code = PROMPT_VALIDATION_FAILED;
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues[0] || "Model response failed schema validation.");
    this.name = "PromptValidationError";
    this.issues = issues;
  }
}

export class PromptRenderError extends Error {
  readonly code = PROMPT_RENDER_FAILED;
  constructor(message: string) {
    super(message);
    this.name = "PromptRenderError";
  }
}
