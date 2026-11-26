"use client";

import type { HireStageGroup } from "@/lib/onboarding/hire-stage-groups";
import { HireFigmaIcon, PRE_HIRE_UI_ICONS } from "./hire-figma-assets";

export function HireStageStepper({ stages }: { stages: HireStageGroup[] }) {
  if (!stages.length) return null;

  const ICON_PX = 20;
  const LINE_H = 2;

  return (
    <nav aria-label="Hire stage progress" className="w-full min-w-0 overflow-x-auto pb-8 [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto flex w-max max-w-full items-start justify-center px-2 sm:px-4">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          const done = stage.status === "completed";
          const current = stage.status === "current" || stage.status === "in_progress";
          const upcoming = !done && !current;
          const connectorFilled = done;

          return (
            <div key={stage.id} className="flex items-start">
              <div className="relative shrink-0" style={{ width: ICON_PX, height: ICON_PX }}>
                {done ? (
                  <HireFigmaIcon
                    src={PRE_HIRE_UI_ICONS.stageCheckFilled}
                    width={ICON_PX}
                    height={ICON_PX}
                    tint="var(--hj-stepper, var(--brand-primary))"
                    className="relative z-10 block"
                  />
                ) : current ? (
                  <HireFigmaIcon
                    src={PRE_HIRE_UI_ICONS.stepperCurrent}
                    width={ICON_PX}
                    height={ICON_PX}
                    tint="var(--hj-stepper, var(--brand-primary))"
                    className="relative z-10 block"
                  />
                ) : (
                  <span
                    className="relative z-10 block rounded-full border-2 border-[#D1D5DB] bg-white"
                    style={{ width: ICON_PX, height: ICON_PX }}
                    aria-hidden
                  />
                )}
                <span
                  className="absolute left-1/2 top-full mt-2 max-w-[4.5rem] -translate-x-1/2 text-center text-[10px] font-medium leading-tight sm:max-w-none sm:whitespace-nowrap sm:text-xs"
                  style={{ color: upcoming ? "#9CA3AF" : "var(--hj-stepper, var(--brand-primary))" }}
                >
                  {stage.name}
                </span>
              </div>

              {!isLast ? (
                <div
                  className="h-0.5 w-10 shrink-0 sm:w-[72px] md:w-[100px] lg:w-[124px]"
                  style={{
                    marginTop: (ICON_PX - LINE_H) / 2,
                    backgroundColor: connectorFilled
                      ? "var(--hj-stepper, var(--brand-primary))"
                      : "#E5E7EB",
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
