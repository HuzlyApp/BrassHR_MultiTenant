"use client";

export function underlineTabButtonClass(isActive: boolean): string {
  return `shrink-0 px-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
    isActive
      ? "-mb-px border-b-2 border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
      : "border-b-2 border-transparent text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
  }`;
}

type UnderlineTabBarProps<T extends string> = {
  tabs: readonly { id: T; label: string }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  ariaLabel?: string;
  className?: string;
  align?: "start" | "center";
};

export default function UnderlineTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = "Sections",
  className = "",
  align = "center",
}: UnderlineTabBarProps<T>) {
  const alignClass =
    align === "start" ? "mx-0 justify-start" : "mx-auto justify-center";

  return (
    <nav
      className={`flex w-full items-end gap-x-8 border-b border-[#E5E7EB] ${alignClass} ${className}`}
      aria-label={ariaLabel}
    >
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={underlineTabButtonClass(activeTab === id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
