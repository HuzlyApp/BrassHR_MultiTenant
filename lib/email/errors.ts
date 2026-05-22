export type SendEmailErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SEND_FAILED"
  | "INTERNAL_ERROR";

export class SendEmailError extends Error {
  readonly code: SendEmailErrorCode;
  readonly status: number;

  constructor(code: SendEmailErrorCode, message: string, status: number) {
    super(message);
    this.name = "SendEmailError";
    this.code = code;
    this.status = status;
  }
}
