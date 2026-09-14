export class ServiceAreaDeniedError extends Error {
  readonly code: string;
  readonly messageKey: string;
  readonly field: string;
  readonly reasonCode: string;
  readonly status = 422;

  constructor(options: {
    code: string;
    messageKey: string;
    field: string;
    publicMessage: string;
  }) {
    super(options.publicMessage);
    this.name = "ServiceAreaDeniedError";
    this.code = options.code;
    this.messageKey = options.messageKey;
    this.field = options.field;
    this.reasonCode = options.code;
  }

  toJSON(publicClient = false) {
    return {
      error: {
        code: publicClient ? this.messageKey : this.code,
        messageKey: this.messageKey,
        field: this.field,
      },
    };
  }
}

export class TenantWaitlistedError extends Error {
  readonly code = "TENANT_WAITLISTED";
  readonly status = 422;
  constructor(message = "This account cannot publish jobs or open the time clock yet.") {
    super(message);
    this.name = "TenantWaitlistedError";
  }
}

export function isOpenJobServiceAreaHoldError(error: unknown): boolean {
  const record = error && typeof error === "object" ? (error as { message?: unknown; code?: unknown }) : null;
  const message = String(record?.message ?? "");
  return /this work location isn[’']t available yet/i.test(message);
}
