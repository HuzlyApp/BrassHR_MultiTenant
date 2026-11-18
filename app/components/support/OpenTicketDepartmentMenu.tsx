"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { SUPPORT_DEPARTMENTS } from "@/lib/support-tickets/support-departments";
import type { DepartmentRecord } from "@/lib/departments/types";

type MenuDepartment = {
  id: string;
  category: string;
  title: string;
  description: string;
};

type Props = {
  onSelectDepartment: (category: string) => void;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  label?: string;
  /** When provided, skip the org-departments fetch and use these options. */
  departments?: MenuDepartment[];
};

const MENU_WIDTH = 280;
const MENU_ESTIMATED_HEIGHT = 360;

const FALLBACK_DEPARTMENTS: MenuDepartment[] = SUPPORT_DEPARTMENTS.map((dept) => ({
  id: dept.id,
  category: dept.category,
  title: dept.title,
  description: dept.description,
}));

function toMenuDepartments(rows: DepartmentRecord[]): MenuDepartment[] {
  return rows
    .filter((row) => row.isActive)
    .map((row) => ({
      id: row.id,
      category: row.id,
      title: row.name,
      description: row.description?.trim() || row.primaryContact?.trim() || "Open a ticket for this department.",
    }));
}

export function OpenTicketDepartmentMenu({
  onSelectDepartment,
  buttonClassName,
  buttonStyle,
  label = "Open a Ticket",
  departments: departmentsProp,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ visibility: "hidden" });
  const [departments, setDepartments] = useState<MenuDepartment[]>(
    departmentsProp?.length ? departmentsProp : FALLBACK_DEPARTMENTS
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (departmentsProp) {
      setDepartments(departmentsProp.length ? departmentsProp : FALLBACK_DEPARTMENTS);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/admin/departments", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const rows = (payload.departments ?? []) as DepartmentRecord[];
        const mapped = toMenuDepartments(rows);
        if (alive && mapped.length > 0) setDepartments(mapped);
      } catch {
        // Keep fallback catalog.
      }
    })();
    return () => {
      alive = false;
    };
  }, [departmentsProp]);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || MENU_ESTIMATED_HEIGHT;

    let top = rect.bottom + 8;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 8);
    }

    const left = Math.max(
      8,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
    );

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: MENU_WIDTH,
      visibility: "visible",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, departments]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={
          buttonClassName ??
          "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold leading-4 text-white transition hover:brightness-95"
        }
        style={buttonStyle}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Select a department"
              style={menuStyle}
              className="z-[250] max-h-[min(70vh,420px)] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-xl"
            >
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onSelectDepartment(dept.category);
                  }}
                  className="flex w-full flex-col items-start px-3.5 py-2.5 text-left transition hover:bg-[#F8FAFC]"
                >
                  <span className="text-sm font-medium text-[#0F172A]">{dept.title}</span>
                  <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-[#64748B]">
                    {dept.description}
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
