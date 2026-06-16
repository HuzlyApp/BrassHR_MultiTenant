export type RecruiterTemplateErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "TENANT_MISMATCH"
  | "FIRMA_ERROR"
  | "NOT_CONFIGURED"
  | "PUBLISH_BLOCKED"
  | "INTERNAL_ERROR";

export class RecruiterTemplateError extends Error {
  readonly code: RecruiterTemplateErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: RecruiterTemplateErrorCode,
    message: string,
    status = 400,
    details?: unknown
  ) {
    super(message);
    this.name = "RecruiterTemplateError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
