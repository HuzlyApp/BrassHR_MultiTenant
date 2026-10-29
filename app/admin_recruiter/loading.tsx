export default function AdminRecruiterLoading() {
  return (
    <div className="flex-1 px-4 py-6 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page</span>
      <div className="h-8 w-48 rounded bg-white motion-safe:animate-pulse" />
      <div className="mt-4 h-40 rounded-lg bg-white motion-safe:animate-pulse" />
      <div className="mt-4 h-24 rounded-lg bg-white motion-safe:animate-pulse" />
    </div>
  );
}
