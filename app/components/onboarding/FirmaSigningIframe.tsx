"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  computeFirmaEmbedScale,
  FIRMA_EMBED_MOBILE_MAX_SCALE,
  FIRMA_NATIVE_EMBED_MAX_WIDTH,
  resolveFirmaEmbedDimensions,
} from "@/lib/firma/firma-signing-embed-scale";

type FirmaSigningIframeProps = {
  iframeUrl: string | null;
  title?: string;
  testId?: string;
  /** Modal embed scales to fit phone/tablet viewports while keeping Firma controls visible. */
  variant?: "default" | "modal";
  /** When set, renders a close control inside the signing interface frame (not outside it). */
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
  /** Host close sits above the iframe; hide it while Firma UI (e.g. signature board) is focused. */
  const [firmaChromeActive, setFirmaChromeActive] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  useEffect(() => {
    const updateViewport = () => setIsNarrowViewport(window.innerWidth <= FIRMA_NATIVE_EMBED_MAX_WIDTH);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

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

    const markFirmaActive = () => setFirmaChromeActive(true);

    const onWindowBlur = () => {
      requestAnimationFrame(() => {
        if (document.activeElement === iframeRef.current) {
          setFirmaChromeActive(true);
        }
      });
    };

    const onWindowFocus = () => {
      if (window.innerWidth <= FIRMA_NATIVE_EMBED_MAX_WIDTH) return;
      requestAnimationFrame(() => {
        if (document.activeElement !== iframeRef.current) {
          setFirmaChromeActive(false);
        }
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin !== "string" || !event.origin.includes("firma.dev")) return;
      const type =
        typeof event.data === "object" && event.data != null && "type" in event.data
          ? String((event.data as { type?: unknown }).type ?? "")
          : "";
      if (!type.startsWith("signing.")) return;
      if (type === "signing.completed" || type === "signing.declined") {
        setFirmaChromeActive(false);
        return;
      }
      setFirmaChromeActive(true);
    };

    const onPointerDownCapture = (event: PointerEvent) => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      if (event.target === iframe) {
        markFirmaActive();
        return;
      }
      const shell = iframe.closest("[data-firma-embed-shell='true']");
      if (!shell) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[data-testid="firma-signing-close"]')) {
        return;
      }
      const rect = shell.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        markFirmaActive();
      }
    };

    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("message", onMessage);
    document.addEventListener("pointerdown", onPointerDownCapture, true);

    return () => {
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [variant, onClose, iframeUrl]);

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

  if (variant !== "modal") {
    return (
      <iframe
        ref={iframeRef}
        data-testid={testId}
        src={iframeUrl}
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

  const closeButton =
    onClose && !isNarrowViewport && !firmaChromeActive ? (
      <button
        type="button"
        onClick={onClose}
        className="absolute z-30 right-12 top-[4.75rem] inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-black shadow-md transition hover:bg-slate-100"
        aria-label="Close signing"
        data-testid="firma-signing-close"
      >
        <X className="h-4 w-4 text-black" strokeWidth={2.5} aria-hidden />
      </button>
    ) : null;

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
          src={iframeUrl}
          title={title}
          className="block h-full w-full border-0 bg-transparent"
          style={{ width: "100%", height: "100%", transform: "none" }}
          allow="camera; microphone; clipboard-write"
        />
        {closeButton}
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
          <iframe
            ref={iframeRef}
            data-testid={testId}
            src={iframeUrl}
            title={title}
            className="block border-0 bg-transparent"
            style={{
              width: `${layout.embedWidth}px`,
              height: `${layout.embedHeight}px`,
            }}
            allow="camera; microphone; clipboard-write"
          />
        </div>
        {closeButton}
      </div>
    </div>
  );
}
