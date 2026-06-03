"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useState, type RefObject } from "react";

type ConnectorMenuPortalProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
};

export default function ConnectorMenuPortal({
  open,
  anchorRef,
  children,
}: ConnectorMenuPortalProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  useLayoutEffect(() => {
    const anchorEl = anchorRef.current;
    if (!open || !anchorEl) {
      setPosition(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="nodrag nopan pointer-events-auto"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
        zIndex: 99999,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
