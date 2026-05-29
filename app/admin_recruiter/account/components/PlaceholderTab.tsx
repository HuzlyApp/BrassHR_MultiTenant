"use client";

type PlaceholderTabProps = {
  title: string;
  description: string;
};

export default function PlaceholderTab({ title, description }: PlaceholderTabProps) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-8 sm:p-10">
      <h2 className="text-base font-semibold text-[#012352]">{title}</h2>
      <p className="mt-2 max-w-xl text-sm text-[#64748B]">{description}</p>
    </div>
  );
}
