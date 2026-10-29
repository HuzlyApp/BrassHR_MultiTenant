export default function SettingsSectionLoading() {
  return (
    <main className="min-w-0 flex-1 px-5 py-5 lg:px-8 lg:py-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading settings</span>
      <div className="h-5 w-40 rounded bg-[#E5E7EB] motion-safe:animate-pulse" />
      <div className="mt-2 h-3 w-64 rounded bg-[#E5E7EB] motion-safe:animate-pulse" />
      <div className="mt-6 h-28 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      <div className="mt-4 h-28 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
    </main>
  );
}
