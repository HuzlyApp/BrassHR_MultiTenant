export type EmailTemplateErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UNSAFE_CONTENT"
  | "INTERNAL_ERROR";

export class EmailTemplateError extends Error {
  readonly code: EmailTemplateErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: EmailTemplateErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EmailTemplateError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
