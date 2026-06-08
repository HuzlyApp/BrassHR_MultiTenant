"use client";

import Image from "next/image";
import { Eye, Pencil } from "lucide-react";

type ChecklistItemData = {
  id: string;
  step: number;
  title: string;
  description: string;
  completed: boolean;
};

const CHECKLIST_ITEMS: ChecklistItemData[] = [
  {
    id: "goals",
    step: 1,
    title: "Select Goals",
    description: "Choose your goals to stay focused and track progress.",
    completed: true,
  },
  {
    id: "business",
    step: 2,
    title: "Business Information",
    description: "Essential details about your business and operations.",
    completed: false,
  },
  {
    id: "branding",
    step: 3,
    title: "Customize Branding",
    description: "Essential details about your business and operations.",
    completed: false,
  },
  {
    id: "domain",
    step: 4,
    title: "Configure your Domain",
    description: "Configure and connect your Brass domain settings.",
    completed: false,
  },
  {
    id: "workflow",
    step: 5,
    title: "Customized Onboarding Workflow",
    description: "Customize your applicant onboarding flow",
    completed: false,
  },
];

function ChecklistRow({ item }: { item: ChecklistItemData }) {
  const { completed, step, title, description } = item;

  return (
    <li
      className={`flex items-center gap-4 rounded-lg border px-4 py-4 sm:px-5 sm:py-5 ${
        completed
          ? "border-[color:var(--brand-primary)] bg-[#F4F4F4]"
          : "border-[#D1D5DB] bg-white"
      }`}
    >
      {completed ? (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white"
          style={{ borderColor: "var(--brand-primary)" }}
          aria-hidden
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Image
              src="/icons/arrow-white.svg"
              alt=""
              width={12}
              height={12}
              className="h-3 w-3"
              aria-hidden
            />
          </span>
        </span>
      ) : (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white text-sm font-semibold"
          style={{ borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }}
          aria-hidden
        >
          {step}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-[#111827]">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[#64748B]">{description}</p>
      </div>

      {completed ? (
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="rounded-md p-1 transition-opacity hover:opacity-80"
            style={{ color: "var(--brand-primary)" }}
            aria-label={`View ${title}`}
          >
            <Eye className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="rounded-md p-1 transition-opacity hover:opacity-80"
            style={{ color: "var(--brand-primary)" }}
            aria-label={`Edit ${title}`}
          >
            <Pencil className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default function ChecklistTab() {
  const completedCount = CHECKLIST_ITEMS.filter((item) => item.completed).length;
  const totalCount = CHECKLIST_ITEMS.length;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      {/* Full-width header inside main card */}
      <div className="flex w-full items-center justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4 sm:px-6 sm:py-5">
        <h2 className="text-lg font-semibold leading-7 text-[#012352]">Onboarding Checklist</h2>
        <p className="shrink-0 text-sm">
          <span className="font-semibold text-[#012352]">{completedCount}</span>
          <span className="text-[#64748B]"> of {totalCount} Completed</span>
        </p>
      </div>

      {/* Checklist items — centered with border */}
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-3xl rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
          <ul className="flex flex-col gap-3" aria-label="Onboarding steps">
            {CHECKLIST_ITEMS.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
