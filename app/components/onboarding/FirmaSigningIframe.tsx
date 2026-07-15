"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeFirmaEmbedScale,
  resolveFirmaEmbedDimensions,
} from "@/lib/firma/firma-signing-embed-scale";

type FirmaSigningIframeProps = {
  iframeUrl: string | null;
  title?: string;
  testId?: string;
  /** Modal embed scales to fit phone/tablet viewports while keeping Firma controls visible. */
  variant?: "default" | "modal";
};

type FirmaEmbedLayout = {
  scale: number;
  embedWidth: number;
  embedHeight: number;
  scaledWidth: number;
  scaledHeight: number;
};

const brandingShellBgClass =
  "bg-[linear-gradient(135deg,var(--brand-gradient-from)_0%,var(--brand-gradient-to)_100%)]";

/** Height of the embed container that is actually visible (handles browser zoom + mobile browser chrome). */
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

function resolveFirmaEmbedLayout(container: HTMLElement): FirmaEmbedLayout {
  const availableWidth = container.clientWidth;
  const availableHeight = visibleContainerHeight(container);
  const viewportWidth = window.innerWidth;
  const { width: embedWidth, height: embedHeight } = resolveFirmaEmbedDimensions(
    viewportWidth,
    availableWidth,
    availableHeight
  );
  const scale = computeFirmaEmbedScale(availableWidth, availableHeight, embedWidth, embedHeight);

  return {
    scale,
    embedWidth,
    embedHeight,
    scaledWidth: Math.ceil(embedWidth * scale),
    scaledHeight: Math.ceil(embedHeight * scale),
  };
}

export function FirmaSigningIframe({
  iframeUrl,
  title = "Document Signing",
  testId = "firma-signing-iframe",
  variant = "default",
}: FirmaSigningIframeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<FirmaEmbedLayout | null>(null);

  useEffect(() => {
    if (variant !== "modal" || !containerRef.current) return;

    const updateLayout = () => {
      const container = containerRef.current;
      if (!container) return;
      setLayout(resolveFirmaEmbedLayout(container));
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("scroll", updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLayout);
      window.visualViewport?.removeEventListener("resize", updateLayout);
      window.visualViewport?.removeEventListener("scroll", updateLayout);
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
          ? "block border-0 bg-transparent max-[639px]:rounded-none"
          : "min-h-[720px] w-full rounded-lg border border-[#e4e7ec] bg-white"
      }
      style={
        variant === "modal" && layout
          ? { width: `${layout.embedWidth}px`, height: `${layout.embedHeight}px` }
          : variant === "modal"
            ? { width: "1080px", height: "1080px" }
            : undefined
      }
      allow="camera; microphone; clipboard-write"
    />
  );

  if (variant === "modal") {
    if (!layout) {
      return (
        <div
          ref={containerRef}
          className={`h-full min-h-0 w-full ${brandingShellBgClass}`}
          aria-hidden
        />
      );
    }

    return (
      <div
        ref={containerRef}
        className={`flex h-full min-h-0 w-full items-center justify-center overflow-hidden overscroll-none ${brandingShellBgClass}`}
      >
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: `${layout.scaledWidth}px`,
            height: `${layout.scaledHeight}px`,
          }}
        >
          <div
            className="origin-top-left"
            style={{
              transform: `scale(${layout.scale})`,
              width: `${layout.embedWidth}px`,
              height: `${layout.embedHeight}px`,
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
