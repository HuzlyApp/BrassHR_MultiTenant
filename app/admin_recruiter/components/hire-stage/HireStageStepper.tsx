"use client";

import { Check } from "lucide-react";
import type { HireStageGroup } from "@/lib/onboarding/hire-stage-groups";

export function HireStageStepper({ stages }: { stages: HireStageGroup[] }) {
  if (!stages.length) return null;

  return (
    <nav
      aria-label="Hire stage progress"
      className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm"
    >
      <ol className="flex min-w-max items-start gap-0">
        {stages.map((stage, index) => {
          const done = stage.status === "completed";
          const current = stage.status === "current" || stage.status === "in_progress";
          const locked = stage.status === "locked";
          return (
            <li key={stage.id} className="flex items-center">
              <div className="flex w-[112px] flex-col items-center gap-2 text-center">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                    done
                      ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white"
                      : current
                        ? "border-[color:var(--brand-primary)] bg-white text-[color:var(--brand-primary)]"
                        : "border-[#D1D5DB] bg-white text-[#9CA3AF]"
                  }`}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
                <span
                  className={`max-w-[100px] text-[11px] font-medium leading-tight ${
                    locked
                      ? "text-[#9CA3AF]"
                      : current
                        ? "text-[color:var(--brand-secondary)]"
                        : "text-[#374151]"
                  }`}
                >
                  {stage.name}
                </span>
              </div>
              {index < stages.length - 1 ? (
                <div
                  className={`mb-5 h-0.5 w-8 shrink-0 ${
                    done ? "bg-[color:var(--brand-primary)]" : "bg-[#E5E7EB]"
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
