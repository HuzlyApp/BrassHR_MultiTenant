"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MoreHorizontal, Plus, Search } from "lucide-react";
import { CARD_BORDER, DRAG_DATA_TYPE, TEXT_PRIMARY, TEXT_SECONDARY } from "./constants";
import type { StepCategory, StepDefinition } from "./types";

type StepsLibraryProps = {
  categories: StepCategory[];
  title?: string;
  searchTerm?: string;
};

export default function StepsLibrary({
  categories,
  title = "Steps Library",
  searchTerm = "",
}: StepsLibraryProps) {
  const [localSearch, setLocalSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const effectiveSearch = searchTerm || localSearch;

  const filtered = useMemo(() => {
    const q = effectiveSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        steps: cat.steps.filter((s) => s.label.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.steps.length > 0);
  }, [effectiveSearch, categories]);

  return (
    <aside
      className="flex h-full w-[280px] shrink-0 flex-col border-r bg-[#ECF1F9]"
      style={{ borderColor: CARD_BORDER }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: CARD_BORDER }}
      >
        <h2 className="text-sm font-semibold leading-5" style={{ color: TEXT_PRIMARY }}>
          {title}
        </h2>
      </div>

      <div className="border-b px-4 py-3" style={{ borderColor: CARD_BORDER }}>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            color="#98a2b3"
          />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search steps"
            className="h-9 w-full rounded-lg border bg-[#f9fafb] pl-8 pr-3 text-xs outline-none transition focus:border-[#BC8B41] focus:bg-white focus:ring-2 focus:ring-[#BC8B41]/20"
            style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs" style={{ color: TEXT_SECONDARY }}>
            No steps found
          </p>
        ) : (
          filtered.map((cat) => {
            const isCollapsed = collapsed[cat.id] ?? false;
            return (
              <section key={cat.id} className="mb-4 last:mb-0">
                <header className="mb-1.5 flex items-center justify-between px-1.5">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !isCollapsed }))}
                    className="flex items-center gap-1 text-[13px] font-semibold leading-5"
                    style={{ color: TEXT_PRIMARY }}
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s",
                      }}
                    />
                    {cat.label}
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 transition hover:bg-[#f2f4f7]"
                    aria-label="Category options"
                  >
                    <MoreHorizontal size={14} color="#98a2b3" />
                  </button>
                </header>

                {!isCollapsed ? (
                  <ul className="flex flex-col gap-1.5">
                    {cat.steps.map((step) => (
                      <li key={step.id}>
                        <StepLibraryItem step={step} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}

function StepLibraryItem({ step }: { step: StepDefinition }) {
  // const color = STEP_COLORS[step.color];

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(DRAG_DATA_TYPE, step.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex cursor-grab items-center gap-2 rounded-lg border bg-white px-2 py-2 transition hover:border-[#BC8B41] hover:bg-[#faf6ef] active:cursor-grabbing"
      style={{ borderColor: CARD_BORDER }}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
        // style={{ backgroundColor: color.header }}
      >
        {step.icon}
      </span>
      <span
        className="flex-1 truncate text-xs font-medium leading-5"
        style={{ color: TEXT_PRIMARY }}
      >
        {step.label}
      </span>
      <Plus
        size={14}
        className="opacity-0 transition-opacity group-hover:opacity-100"
        color="#BC8B41"
      />
    </div>
  );
}
