"use client";

type FirmaSigningIframeProps = {
  iframeUrl: string | null;
  title?: string;
  testId?: string;
};

export function FirmaSigningIframe({
  iframeUrl,
  title = "Document Signing",
  testId = "firma-signing-iframe",
}: FirmaSigningIframeProps) {
  if (!iframeUrl) {
    return (
      <div
        data-testid="firma-signing-iframe-missing"
        className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-[#d0d5dd] bg-[#f8fafc] px-6 text-center text-sm text-[#667085]"
      >
        Signing document is not available yet.
      </div>
    );
  }

  return (
    <iframe
      data-testid={testId}
      src={iframeUrl}
      title={title}
      className="min-h-[720px] w-full rounded-lg border border-[#e4e7ec] bg-white"
      allow="camera; microphone; clipboard-write"
    />
  );
}
