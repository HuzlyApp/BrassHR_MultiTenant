type SidebarSubmenuToggleIconProps = {
  open: boolean;
};

const SIDEBAR_SUBMENU_RIGHT_ARROW_SRC = "/icons/right-Arrow.svg";
const SIDEBAR_SUBMENU_DOWN_ARROW_SRC = "/icons/down-Arrow.svg";

/** Default gray expand/collapse chevrons for sidebar submenus (not tenant-branded). */
export function SidebarSubmenuToggleIcon({ open }: SidebarSubmenuToggleIconProps) {
  return (
    <img
      src={open ? SIDEBAR_SUBMENU_DOWN_ARROW_SRC : SIDEBAR_SUBMENU_RIGHT_ARROW_SRC}
      alt=""
      width={24}
      height={24}
      className="h-6 w-6 shrink-0 object-contain"
      aria-hidden
    />
  );
}
