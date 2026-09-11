"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Briefcase,
  ClipboardList,
  FileStack,
  FileText,
  FlaskConical,
  Handshake,
  IdCard,
  Link2,
  Paperclip,
  ShieldCheck,
  Users,
  UserRound,
} from "lucide-react";
import type { CandidateWorkflowStepView } from "@/lib/onboarding/candidate-workflow-phase-view";

type IconTone = "gold" | "navy" | "blue" | "teal";

const TONE_CLASS: Record<IconTone, string> = {
  gold: "bg-[color-mix(in_srgb,var(--brand-primary)_18%,white)] text-[color:var(--brand-primary)]",
  navy: "bg-[#E8EEF7] text-[color:var(--brand-secondary)]",
  blue: "bg-[#DBEAFE] text-[#1D4ED8]",
  teal: "bg-[#CCFBF1] text-[#0F766E]",
};

function matchIcon(step: CandidateWorkflowStepView): { Icon: LucideIcon; tone: IconTone } {
  const hay = `${step.stepKey} ${step.stepType} ${step.title}`.toLowerCase();
  if (/reference/.test(hay)) return { Icon: Users, tone: "gold" };
  if (/interview/.test(hay)) return { Icon: Users, tone: "blue" };
  if (/want.?to.?hire|briefcase|hire.?intent/.test(hay)) return { Icon: Briefcase, tone: "blue" };
  if (/extra.?file|attach|paperclip|document.?upload|collect.?file/.test(hay))
    return { Icon: Paperclip, tone: "gold" };
  if (/extra.?form|custom.?form|form/.test(hay)) return { Icon: ClipboardList, tone: "navy" };
  if (/screen|skill.?test|assess/.test(hay)) return { Icon: ClipboardList, tone: "navy" };
  if (/background|oig|exclusion|adverse/.test(hay)) return { Icon: ShieldCheck, tone: "teal" };
  if (/drug/.test(hay)) return { Icon: FlaskConical, tone: "teal" };
  if (/license|credential|id.?card/.test(hay)) return { Icon: IdCard, tone: "navy" };
  if (/ssn|identity/.test(hay)) return { Icon: FileText, tone: "navy" };
  if (/agreement|offer|contract/.test(hay)) return { Icon: Handshake, tone: "gold" };
  if (/approv|sign.?off/.test(hay)) return { Icon: BadgeCheck, tone: "teal" };
  if (/sent.?to.?client|release.?to.?client|msp|submission/.test(hay))
    return { Icon: UserRound, tone: "blue" };
  if (/link|url/.test(hay)) return { Icon: Link2, tone: "gold" };
  if (/file|doc|resume|profile/.test(hay)) return { Icon: FileStack, tone: "gold" };
  return { Icon: FileText, tone: "navy" };
}

export function HireStepTypeIcon({ step }: { step: CandidateWorkflowStepView }) {
  const { Icon, tone } = matchIcon(step);
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CLASS[tone]}`}
      aria-hidden
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}
