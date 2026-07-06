/** Inactive sidebar menu/submenu text — fixed black, not tenant-brandable. */
export const SIDEBAR_NAV_INACTIVE_HEX = "#111827";

export const SIDEBAR_NAV_INACTIVE_TEXT_CLASS = "text-[#111827]";

export const SIDEBAR_NAV_ACTIVE_TEXT_CLASS = "text-[color:var(--brand-primary)]";

/** Top-level sidebar row text (parent items). */
export function sidebarNavTextClass(active: boolean): string {
  return active
    ? SIDEBAR_NAV_ACTIVE_TEXT_CLASS
    : `${SIDEBAR_NAV_INACTIVE_TEXT_CLASS} hover:text-[color:var(--brand-primary)]`;
}

/** Submenu link text. */
export function sidebarSubmenuTextClass(active: boolean, disabled = false): string {
  const color = active ? SIDEBAR_NAV_ACTIVE_TEXT_CLASS : SIDEBAR_NAV_INACTIVE_TEXT_CLASS;
  const hover = !active && !disabled ? " hover:text-[color:var(--brand-primary)]" : "";
  return `${color}${hover}${disabled ? " opacity-60" : ""}`;
}
