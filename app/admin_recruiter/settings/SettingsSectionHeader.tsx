import type { ReactNode } from "react";

type SettingsSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function SettingsSectionHeader({
  title,
  description,
  actions,
}: SettingsSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-7 tracking-tight text-[#101828]">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-[#6B7280]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 min-[500px]:w-auto md:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
