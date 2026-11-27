"use client";

import { useEffect, useRef } from "react";
import {
  MATCH_PROGRESSION_STEPS,
  canSelectMatchProgressionStep,
  type MatchProgressionStep,
  type MatchProgressionStepId,
} from "@/lib/jobs/match-analysis/progression";

type MatchProgressionStepperProps = {
  viewedIndex: number;
  unlockedIndex: number;
  canAdvance: boolean;
  onSelect: (index: number) => void;
};

type StepTone = "current" | "completed" | "upcoming";

const CHEVRON_SRC = "/icons/admin-recruiter/ai-analysis/chevron.svg";

const STEP_ICONS: Record<
  MatchProgressionStepId,
  { src: string; frameClass: string; nested?: boolean }
> = {
  quick: {
    src: "/icons/admin-recruiter/ai-analysis/doc-text-search.svg",
    frameClass: "relative size-5 shrink-0",
  },
  verifications: {
    src: "/icons/admin-recruiter/ai-analysis/shield-check.svg",
    frameClass: "relative size-6 shrink-0",
  },
  follow_up: {
    src: "/icons/admin-recruiter/ai-analysis/email-edit.svg",
    frameClass: "relative size-6 shrink-0",
  },
  deep: {
    src: "/icons/admin-recruiter/ai-analysis/refresh-user.svg",
    frameClass: "relative h-6 w-[25px] shrink-0",
  },
  submission: {
    src: "/icons/admin-recruiter/ai-analysis/folder-check.svg",
    frameClass: "relative size-6 shrink-0 overflow-hidden",
    nested: true,
  },
};

function stepTone(index: number, viewedIndex: number): StepTone {
  if (index === viewedIndex) return "current";
  if (index < viewedIndex) return "completed";
  return "upcoming";
}

function StepGlyph({ stepId }: { stepId: MatchProgressionStepId }) {
  const icon = STEP_ICONS[stepId];

  if (icon.nested) {
    return (
      <span className={icon.frameClass}>
        <span className="absolute inset-[20.83%_12.5%]">
          <span className="absolute inset-[-5.36%_-4.17%]">
            <img alt="" className="block max-w-none" src={icon.src} />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={icon.frameClass}>
      <img alt="" className="block max-w-none" src={icon.src} />
    </span>
  );
}

function StepSubtitle({ text, tone }: { text: string; tone: StepTone }) {
  const parts = text.split(/\s*[·•]\s*/).filter(Boolean);
  const color =
    tone === "completed"
      ? "text-white"
      : tone === "current"
        ? "text-[#94A3B8]"
        : "text-[#6B7280]";
  const bulletColor = tone === "upcoming" ? "text-[#94A3B8]" : color;

  if (parts.length < 2) {
    return (
      <span className={`text-xs font-normal leading-4 ${color}`}>{text}</span>
    );
  }

  return (
    <span className={`flex flex-wrap items-center gap-1 text-xs font-normal leading-4 ${color}`}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <span className={bulletColor}>•</span> : null}
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
}

function StepButton({
  step,
  index,
  viewedIndex,
  unlockedIndex,
  canAdvance,
  onSelect,
  compact = false,
  mobileRow = false,
  itemRef,
}: {
  step: MatchProgressionStep;
  index: number;
  viewedIndex: number;
  unlockedIndex: number;
  canAdvance: boolean;
  onSelect: (index: number) => void;
  compact?: boolean;
  /** Fixed-width card in a horizontal mobile track */
  mobileRow?: boolean;
  itemRef?: (node: HTMLLIElement | null) => void;
}) {
  const tone = stepTone(index, viewedIndex);
  const enabled = canSelectMatchProgressionStep({
    index,
    unlockedIndex,
    canAdvance,
  });

  const cardClass =
    tone === "current"
      ? "bg-[color:var(--brand-secondary)] text-white"
      : tone === "completed"
        ? "bg-[color:var(--brand-primary)] text-white"
        : "border border-solid border-[#CBD5E1] bg-white text-[#374151]";
  const hoverClass = !enabled
    ? "cursor-not-allowed"
    : tone === "upcoming"
      ? "cursor-pointer hover:border-[#94A3B8]"
      : "cursor-pointer hover:brightness-[0.97]";
  const labelColor = tone === "upcoming" ? "text-[#374151]" : "text-white";

  const liClass = mobileRow
    ? "w-[min(17.5rem,78vw)] shrink-0 snap-center"
    : compact
      ? "w-full"
      : "min-w-[12.5rem] flex-1 sm:min-w-[13.75rem] lg:min-w-0";

  return (
    <li ref={itemRef} className={liClass}>
      <button
        type="button"
        disabled={!enabled}
        aria-current={tone === "current" ? "step" : undefined}
        onClick={() => onSelect(index)}
        className={`flex h-full w-full items-center justify-center rounded-lg px-3 py-3 text-left transition sm:px-3.5 ${
          compact || mobileRow ? "min-h-[72px]" : "min-h-[86px]"
        } ${cardClass} ${hoverClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]`}
      >
        <span className="flex w-full items-center gap-3 sm:gap-3.5">
          <span className="flex shrink-0 items-center justify-center">
            <span
              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full p-2 ${
                compact || mobileRow ? "size-9" : "size-10"
              } ${tone === "completed" ? "bg-[#001A46]" : "bg-[color:var(--brand-primary)]"}`}
            >
              <StepGlyph stepId={step.id} />
            </span>
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 sm:gap-1">
            <span className="flex flex-col items-start">
              <span
                className={`font-normal ${labelColor} ${
                  step.stepNumber === 1 ? "text-xs leading-4" : "text-sm leading-5"
                }`}
              >
                STEP {step.stepNumber}
              </span>
              <span className={`text-sm font-semibold leading-5 sm:text-base ${labelColor}`}>
                {step.label}
              </span>
            </span>
            <StepSubtitle text={step.subtitle} tone={tone} />
          </span>
        </span>
      </button>
    </li>
  );
}

function centerStepInScroller(
  scroller: HTMLElement | null,
  stepEl: HTMLElement | null,
  behavior: ScrollBehavior = "smooth"
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

export function MatchProgressionStepper({
  viewedIndex,
  unlockedIndex,
  canAdvance,
  onSelect,
}: MatchProgressionStepperProps) {
  const mobileScrollerRef = useRef<HTMLDivElement>(null);
  const mobileStepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const didCenterOnMount = useRef(false);

  useEffect(() => {
    const scroller = mobileScrollerRef.current;
    const stepEl = mobileStepRefs.current[viewedIndex] ?? null;
    if (!scroller || !stepEl) return;

    // Instant center on first paint so the active step is mid-screen when opening AI Analysis.
    const behavior: ScrollBehavior = didCenterOnMount.current ? "smooth" : "auto";
    didCenterOnMount.current = true;

    const frame = window.requestAnimationFrame(() => {
      centerStepInScroller(scroller, stepEl, behavior);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewedIndex]);

  return (
    <nav aria-label="AI match progression" className="w-full min-w-0">
      {/* Mobile: horizontal row; active step centered in the viewport */}
      <div
        ref={mobileScrollerRef}
        className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      >
        <ol className="flex w-max items-stretch gap-2 px-[max(0.75rem,calc((100%-min(17.5rem,78vw))/2))]">
          {MATCH_PROGRESSION_STEPS.map((step, index) => (
            <StepButton
              key={step.id}
              step={step}
              index={index}
              viewedIndex={viewedIndex}
              unlockedIndex={unlockedIndex}
              canAdvance={canAdvance}
              onSelect={onSelect}
              mobileRow
              itemRef={(node) => {
                mobileStepRefs.current[index] = node;
              }}
            />
          ))}
        </ol>
      </div>

      {/* Tablet+: horizontal track with scroll only when needed */}
      <div className="hidden w-full min-w-0 overflow-x-auto pb-1 md:block">
        <ol className="flex w-full min-w-0 items-stretch lg:min-w-0">
          {MATCH_PROGRESSION_STEPS.flatMap((step, index) => {
            const nodes = [
              <StepButton
                key={step.id}
                step={step}
                index={index}
                viewedIndex={viewedIndex}
                unlockedIndex={unlockedIndex}
                canAdvance={canAdvance}
                onSelect={onSelect}
              />,
            ];
            if (index < MATCH_PROGRESSION_STEPS.length - 1) {
              nodes.push(
                <li
                  key={`${step.id}-chevron`}
                  className="flex shrink-0 items-center justify-center px-1.5 lg:px-2.5"
                  aria-hidden
                >
                  <img alt="" className="block max-w-none" src={CHEVRON_SRC} />
                </li>
              );
            }
            return nodes;
          })}
        </ol>
      </div>
    </nav>
  );
}
