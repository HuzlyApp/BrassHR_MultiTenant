export type FirmaErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "NETWORK_ERROR"
  | "API_ERROR";

export class FirmaError extends Error {
  readonly code: FirmaErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: FirmaErrorCode, message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "FirmaError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
