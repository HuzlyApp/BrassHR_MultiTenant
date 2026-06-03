"use client";

import { useEffect, useRef } from "react";

import { NAVY } from "./constants";

export type ConnectorMenuAction =
  | "addParallelFlow"
  | "addStep"
  | "removeConnector"
  | "addTitle";

type ConnectorActionMenuProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (action: ConnectorMenuAction) => void;
  /** Hide parallel option when branch already split. */
  showParallelFlow?: boolean;
  /** Clicks on this element (e.g. + button) should not close the menu. */
  anchorEl?: HTMLElement | null;
};

const MENU_ITEMS: Array<{
  action: ConnectorMenuAction;
  label: string;
  parallelOnly?: boolean;
}> = [
  { action: "addParallelFlow", label: "Add parallel flow", parallelOnly: true },
  { action: "addStep", label: "Add step" },
  { action: "removeConnector", label: "Remove connector" },
  { action: "addTitle", label: "Title" },
];

export default function ConnectorActionMenu({
  open,
  onClose,
  onSelect,
  showParallelFlow = true,
  anchorEl = null,
}: ConnectorActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorEl]);

  if (!open) return null;

  const items = MENU_ITEMS.filter(
    (item) => !item.parallelOnly || showParallelFlow
  );

  return (
    <div
      ref={menuRef}
      className="nodrag nopan min-w-[180px] overflow-hidden rounded-lg border bg-white py-1 shadow-xl"
      style={{ borderColor: "#e2e8f0" }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          className="w-full px-3 py-2 text-left text-xs font-medium transition hover:bg-[#eff6ff]"
          style={{ color: NAVY }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item.action);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
