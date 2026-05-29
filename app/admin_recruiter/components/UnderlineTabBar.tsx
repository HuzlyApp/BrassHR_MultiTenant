"use client";

export function underlineTabButtonClass(isActive: boolean): string {
  return `shrink-0 px-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
    isActive
      ? "-mb-px border-b-2 border-[#BC8B41] text-[#BC8B41]"
      : "border-b-2 border-transparent text-[#2B3D51] hover:text-[#BC8B41]"
  }`;
}

type UnderlineTabBarProps<T extends string> = {
  tabs: readonly { id: T; label: string }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  ariaLabel?: string;
  className?: string;
};

export default function UnderlineTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = "Sections",
  className = "",
}: UnderlineTabBarProps<T>) {
  return (
    <nav
      className={`mx-auto flex w-full items-end justify-center gap-x-8 border-b border-[#E5E7EB] ${className}`}
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
