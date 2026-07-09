"use client";

export function AccountErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      {message}
    </div>
  );
}

export function AccountSuccessBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      role="status"
    >
      {message}
    </div>
  );
}

export function AccountLoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-11 rounded-md bg-[#E5E7EB]" />
      ))}
    </div>
  );
}

export function AccountSaveButton({
  saving,
  disabled,
  label = "Save Changes",
}: {
  saving: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className="inline-flex h-10 w-full items-center justify-center rounded-full px-6 text-sm font-medium text-white transition disabled:opacity-60 min-[500px]:w-auto"
      style={{ backgroundColor: "var(--brand-primary)" }}
    >
      {saving ? "Saving…" : label}
    </button>
  );
}
