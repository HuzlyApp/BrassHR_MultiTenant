"use client";

import { useEffect, useRef } from "react";
import type { HireStageGroup } from "@/lib/onboarding/hire-stage-groups";
import { HireFigmaIcon, PRE_HIRE_UI_ICONS } from "./hire-figma-assets";

function centerStepInScroller(
  scroller: HTMLElement | null,
  stepEl: HTMLElement | null,
  behavior: ScrollBehavior = "auto"
) {
  if (!scroller || !stepEl) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const stepRect = stepEl.getBoundingClientRect();
  const nextLeft =
    scroller.scrollLeft +
    (stepRect.left - scrollerRect.left) -
    (scrollerRect.width - stepRect.width) / 2;
  scroller.scrollTo({ left: Math.max(0, nextLeft), behavior });
}

export function HireStageStepper({ stages }: { stages: HireStageGroup[] }) {
  const ICON_PX = 20;
  const LINE_H = 2;
  const scrollerRef = useRef<HTMLElement>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);
  const didCenter = useRef(false);

  const currentIndex = stages.findIndex(
    (stage) => stage.status === "current" || stage.status === "in_progress"
  );

  useEffect(() => {
    if (!stages.length) return;
    const scroller = scrollerRef.current;
    const stepEl = currentStepRef.current;
    if (!scroller || !stepEl) return;

    const behavior: ScrollBehavior = didCenter.current ? "smooth" : "auto";
    didCenter.current = true;
    const frame = window.requestAnimationFrame(() => {
      centerStepInScroller(scroller, stepEl, behavior);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, stages.length]);

  if (!stages.length) return null;

  return (
    <nav
      ref={scrollerRef}
      aria-label="Hire stage progress"
      className="w-full min-w-0 overflow-x-auto overscroll-x-contain pt-2 pb-9 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/*
        min-w-full + justify-center centers when the track fits.
        w-max (without max-w-full) lets it grow and scroll when it doesn't —
        avoid justify-center alone with overflow, which clips the first step.
        pt-2 keeps circle tops from being clipped by the overflow scroller.
      */}
      <div className="flex w-max min-w-full items-start justify-center px-8 sm:px-4">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          const done = stage.status === "completed";
          const current = stage.status === "current" || stage.status === "in_progress";
          const upcoming = !done && !current;
          const connectorFilled = done;

          return (
            <div
              key={stage.id}
              ref={current ? currentStepRef : undefined}
              className="flex items-start"
            >
              <div
                className="relative shrink-0 overflow-visible"
                style={{ width: ICON_PX, height: ICON_PX }}
              >
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
                    className="relative z-10 box-border block rounded-full border-2 border-[#D1D5DB] bg-white"
                    style={{ width: ICON_PX, height: ICON_PX }}
                    aria-hidden
                  />
                )}
                <span
                  className="absolute left-1/2 top-full mt-2 w-max max-w-[5.5rem] -translate-x-1/2 text-center text-[10px] font-medium leading-tight sm:max-w-none sm:whitespace-nowrap sm:text-xs"
                  style={{ color: upcoming ? "#9CA3AF" : "var(--hj-stepper, var(--brand-primary))" }}
                >
                  {stage.name}
                </span>
              </div>

              {!isLast ? (
                <div
                  className="h-0.5 w-8 shrink-0 sm:w-10 md:w-[72px] lg:w-[100px] xl:w-[124px]"
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
