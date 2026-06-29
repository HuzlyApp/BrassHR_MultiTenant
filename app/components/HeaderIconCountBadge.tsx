type HeaderIconCountBadgeProps = {
  count: number;
  max?: number;
};

/** Red circle count badge for header message / notification icons. */
export function HeaderIconCountBadge({ count, max = 9 }: HeaderIconCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white"
      aria-hidden
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
