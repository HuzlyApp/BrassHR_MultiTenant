export type StepProgressSnapshot = {
  status: string | null;
  data: Record<string, unknown>;
  updatedAt: string | null;
};

export class StepProgressConflictError extends Error {
  readonly status = 409;

  constructor() {
    super("This step was updated at the same time. Refresh and try again.");
    this.name = "StepProgressConflictError";
  }
}

const TERMINAL_STATUSES = new Set(["completed", "skipped"]);
const DOWNGRADE_STATUSES = new Set(["pending", "in_progress"]);

export function mergeOnboardingStepData(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(incoming && typeof incoming === "object" ? incoming : {}),
  };
}

export function isTerminalStepDowngrade(
  currentStatus: string | null | undefined,
  nextStatus: string
): boolean {
  return (
    Boolean(currentStatus && TERMINAL_STATUSES.has(currentStatus)) &&
    DOWNGRADE_STATUSES.has(nextStatus)
  );
}

/**
 * Compare-and-swap write. A conflicting update is re-read and merged so
 * parallel saves keep both sides' data keys.
 */
export async function commitOnboardingStepProgress(params: {
  read: () => Promise<StepProgressSnapshot | null>;
  write: (input: {
    expectedUpdatedAt: string | null;
    status: string;
    data: Record<string, unknown>;
    completedAt: string | null;
    updatedAt: string;
  }) => Promise<"ok" | "conflict">;
  status: string;
  data: Record<string, unknown>;
  completedAt: string | null;
  now?: () => string;
  maxAttempts?: number;
}): Promise<{ noop: boolean; attempts: number }> {
  const maxAttempts = params.maxAttempts ?? 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const current = await params.read();
    if (isTerminalStepDowngrade(current?.status, params.status)) {
      return { noop: true, attempts: attempt };
    }
    const updatedAt = (params.now ?? (() => new Date().toISOString()))();
    const outcome = await params.write({
      expectedUpdatedAt: current?.updatedAt ?? null,
      status: params.status,
      data: mergeOnboardingStepData(current?.data, params.data),
      completedAt: params.completedAt,
      updatedAt,
    });
    if (outcome === "ok") return { noop: false, attempts: attempt };
  }
  throw new StepProgressConflictError();
}
