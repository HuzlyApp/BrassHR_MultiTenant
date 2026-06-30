"use client";

type CandidateDetailAddButtonProps = {
  onClick: () => void;
};

export default function CandidateDetailAddButton({ onClick }: CandidateDetailAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 text-[var(--brand-primary)]"
    >
      <span className="text-base leading-none">+</span>
      <span>Add</span>
    </button>
  );
}
