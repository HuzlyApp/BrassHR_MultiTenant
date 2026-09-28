"use client";

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

/** Wide enough for "Follow-Up" + "Enrichment" on one line. */
const STEP_MIN_WIDTH_CLASS = "min-w-[13.75rem] sm:min-w-[14.5rem] lg:min-w-[15.25rem]";

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
      <span className={`whitespace-nowrap text-xs font-normal leading-4 ${color}`}>{text}</span>
    );
  }

  return (
    <span className={`flex items-center gap-1 whitespace-nowrap text-xs font-normal leading-4 ${color}`}>
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
}: {
  step: MatchProgressionStep;
  index: number;
  viewedIndex: number;
  unlockedIndex: number;
  canAdvance: boolean;
  onSelect: (index: number) => void;
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

  return (
    <li className={`${STEP_MIN_WIDTH_CLASS} flex-1`}>
      <button
        type="button"
        disabled={!enabled}
        aria-current={tone === "current" ? "step" : undefined}
        onClick={() => onSelect(index)}
        className={`flex h-full min-h-[86px] w-full items-center justify-center rounded-lg px-3.5 py-3 text-left transition ${cardClass} ${hoverClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]`}
      >
        <span className="flex w-full items-center gap-3.5">
          <span className="flex shrink-0 items-center justify-center">
            <span
              className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full p-2 ${
                tone === "completed" ? "bg-[#001A46]" : "bg-[color:var(--brand-primary)]"
              }`}
            >
              <StepGlyph stepId={step.id} />
            </span>
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-col items-start">
              <span
                className={`whitespace-nowrap font-normal ${labelColor} ${
                  step.stepNumber === 1 ? "text-xs leading-4" : "text-sm leading-5"
                }`}
              >
                STEP {step.stepNumber}
              </span>
              <span
                className={`whitespace-nowrap text-base font-semibold leading-5 ${labelColor}`}
              >
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

export function MatchProgressionStepper({
  viewedIndex,
  unlockedIndex,
  canAdvance,
  onSelect,
}: MatchProgressionStepperProps) {
  return (
    <nav aria-label="AI match progression" className="w-full overflow-x-auto pb-1">
      <ol className="flex w-full min-w-[72rem] items-stretch lg:min-w-[78rem]">
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
                className="flex shrink-0 items-center justify-center px-2.5"
                aria-hidden
              >
                <img alt="" className="block max-w-none" src={CHEVRON_SRC} />
              </li>
            );
          }
          return nodes;
        })}
      </ol>
    </nav>
  );
}
