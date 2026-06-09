"use client";

type AdminBrandingLoaderProps = {
  message?: string;
};

/** Neutral full-screen loader — no tenant or Brass HR branding until API responds. */
export default function AdminBrandingLoader({
  message = "Loading your workspace…",
}: AdminBrandingLoaderProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#F3F5F5]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E5E7EB] border-t-[#64748B]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[#475569]">{message}</p>
      </div>
    </div>
  );
}
