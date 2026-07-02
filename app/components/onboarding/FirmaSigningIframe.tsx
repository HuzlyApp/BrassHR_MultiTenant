"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Firma signing UI at 1:1 needs ~1080px. Modal uses a shorter embed height so the
 * same viewport scales the UI up — header + footer chrome appear ~30% larger.
 */
const MODAL_UI_SIZE_BOOST = 1.3;
const FIRMA_NATURAL_HEIGHT = 1080;
const FIRMA_EMBED_HEIGHT = Math.round(FIRMA_NATURAL_HEIGHT / MODAL_UI_SIZE_BOOST);

/** Allow full 1:1 scale when the modal has enough height. */
const MODAL_MAX_SCALE = 1;

type FirmaSigningIframeProps = {
  iframeUrl: string | null;
  title?: string;
  testId?: string;
  /** Modal embed scales down so Decline / Finish controls stay visible. */
  variant?: "default" | "modal";
};

/** Height of the embed container that is actually visible (handles browser zoom). */
function visibleContainerHeight(container: HTMLElement): number {
  const rect = container.getBoundingClientRect();
  const viewport = window.visualViewport;

  if (!viewport) {
    return container.clientHeight;
  }

  const viewportTop = viewport.offsetTop;
  const viewportBottom = viewportTop + viewport.height;
  const visibleTop = Math.max(rect.top, viewportTop);
  const visibleBottom = Math.min(rect.bottom, viewportBottom);

  return Math.max(0, Math.min(rect.height, visibleBottom - visibleTop));
}

function computeModalScale(availableHeight: number): number {
  if (availableHeight <= 0) return MODAL_MAX_SCALE;

  const paddedHeight = availableHeight - 12;
  const fitScale = paddedHeight / FIRMA_EMBED_HEIGHT;
  const nextScale = Math.min(MODAL_MAX_SCALE, fitScale);

  return Math.max(0.55, nextScale);
}

export function FirmaSigningIframe({
  iframeUrl,
  title = "Document Signing",
  testId = "firma-signing-iframe",
  variant = "default",
}: FirmaSigningIframeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() => (variant === "modal" ? MODAL_MAX_SCALE : 1));

  useEffect(() => {
    if (variant !== "modal" || !containerRef.current) return;

    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;
      setScale(computeModalScale(visibleContainerHeight(container)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateScale);
    window.visualViewport?.addEventListener("resize", updateScale);
    window.visualViewport?.addEventListener("scroll", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
      window.visualViewport?.removeEventListener("resize", updateScale);
      window.visualViewport?.removeEventListener("scroll", updateScale);
    };
  }, [variant, iframeUrl]);

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

  const iframe = (
    <iframe
      data-testid={testId}
      src={iframeUrl}
      title={title}
      className={
        variant === "modal"
          ? `block w-full rounded-lg border border-[#e4e7ec] bg-white`
          : "min-h-[720px] w-full rounded-lg border border-[#e4e7ec] bg-white"
      }
      style={variant === "modal" ? { height: `${FIRMA_EMBED_HEIGHT}px` } : undefined}
      allow="camera; microphone; clipboard-write"
    />
  );

  if (variant === "modal") {
    const scaledHeight = Math.ceil(FIRMA_EMBED_HEIGHT * scale);

    return (
      <div ref={containerRef} className="h-full min-h-0 w-full overflow-hidden">
        <div className="w-full overflow-hidden" style={{ height: `${scaledHeight}px` }}>
          <div
            className="origin-top-left"
            style={{
              transform: `scale(${scale})`,
              width: `${100 / scale}%`,
              height: `${FIRMA_EMBED_HEIGHT}px`,
            }}
          >
            {iframe}
          </div>
        </div>
      </div>
    );
  }

  return iframe;
}
