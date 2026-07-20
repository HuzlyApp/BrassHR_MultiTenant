"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeFirmaEmbedScale,
  FIRMA_EMBED_MOBILE_MAX_SCALE,
  FIRMA_NATIVE_EMBED_MAX_WIDTH,
  resolveFirmaEmbedDimensions,
} from "@/lib/firma/firma-signing-embed-scale";
import { resolveFirmaSigningEmbedUrl } from "@/lib/firma/signing-branding-proxy";

type FirmaSigningIframeProps = {
  iframeUrl: string | null;
  title?: string;
  testId?: string;
  /** Modal embed scales to fit phone/tablet viewports while keeping Firma controls visible. */
  variant?: "default" | "modal";
  /** Escape closes the modal; no visible close control (avoids blocking Firma signature UI). */
  onClose?: () => void;
};

type FirmaEmbedLayout = {
  mode: "native" | "scaled";
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
  const availableWidth = Math.max(1, container.clientWidth);
  const availableHeight = Math.max(1, visibleContainerHeight(container));
  const viewportWidth = window.innerWidth;

  // Phones: fill the viewport with Firmas own responsive UI (readable header/footer).
  if (viewportWidth <= FIRMA_NATIVE_EMBED_MAX_WIDTH) {
    return {
      mode: "native",
      scale: 1,
      embedWidth: availableWidth,
      embedHeight: availableHeight,
      scaledWidth: availableWidth,
      scaledHeight: availableHeight,
    };
  }

  const { width: embedWidth, height: embedHeight } = resolveFirmaEmbedDimensions(
    viewportWidth,
    availableWidth,
    availableHeight
  );
  const scale = computeFirmaEmbedScale(availableWidth, availableHeight, embedWidth, embedHeight, {
    maxScale: viewportWidth < 1024 ? FIRMA_EMBED_MOBILE_MAX_SCALE : undefined,
  });

  return {
    mode: "scaled",
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
  onClose,
}: FirmaSigningIframeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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

  useEffect(() => {
    if (variant !== "modal" || !onClose) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant, onClose]);

  const embedUrl = resolveFirmaSigningEmbedUrl(iframeUrl);

  if (!embedUrl) {
    return (
      <div
        data-testid="firma-signing-iframe-missing"
        className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-[#d0d5dd] bg-[#f8fafc] px-6 text-center text-sm text-[#667085]"
      >
        Signing document is not available yet.
      </div>
    );
  }

  if (variant !== "modal") {
    return (
      <iframe
        ref={iframeRef}
        data-testid={testId}
        src={embedUrl}
        title={title}
        className="min-h-[720px] w-full rounded-lg border border-[#e4e7ec] bg-white"
        allow="camera; microphone; clipboard-write"
      />
    );
  }

  if (!layout) {
    return (
      <div
        ref={containerRef}
        className={`h-full min-h-0 w-full ${brandingShellBgClass}`}
        aria-hidden
      />
    );
  }

  if (layout.mode === "native") {
    return (
      <div
        ref={containerRef}
        data-firma-embed-shell="true"
        className={`relative h-full min-h-0 w-full overflow-hidden overscroll-none ${brandingShellBgClass}`}
      >
        <iframe
          ref={iframeRef}
          data-testid={testId}
          src={embedUrl}
          title={title}
          className="block h-full w-full border-0 bg-transparent"
          style={{ width: "100%", height: "100%", transform: "none" }}
          allow="camera; microphone; clipboard-write"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 w-full items-center justify-center overflow-hidden overscroll-none ${brandingShellBgClass}`}
    >
      <div
        data-firma-embed-shell="true"
        className="relative shrink-0 overflow-hidden rounded-2xl shadow-lg"
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
          <iframe
            ref={iframeRef}
            data-testid={testId}
            src={embedUrl}
            title={title}
            className="block border-0 bg-transparent"
            style={{
              width: `${layout.embedWidth}px`,
              height: `${layout.embedHeight}px`,
            }}
            allow="camera; microphone; clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}
