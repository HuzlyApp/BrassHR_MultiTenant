import { preExtractResumeFields } from "@/lib/resume/normalize-resume-text";
import { parseMatchStage, type MatchStage } from "./match-stage";

export type ContactFieldPatch = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
};

function clean(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function sameEmail(left: string | null | undefined, right: string | null | undefined): boolean {
  return clean(left).toLowerCase() === clean(right).toLowerCase();
}

function phoneDigits(value: string | null | undefined): string {
  return clean(value).replace(/\D/g, "").slice(-10);
}

/**
 * Fields whose extracted-text value changed. Unchanged résumé lines are not
 * treated as profile edits, so a stale résumé cannot overwrite a corrected profile.
 */
export function contactEditsFromExtractedText(
  previousText: string,
  nextText: string
): ContactFieldPatch {
  const before = preExtractResumeFields(previousText);
  const after = preExtractResumeFields(nextText);
  const patch: ContactFieldPatch = {};

  const nextEmail = clean(after.email).toLowerCase();
  if (nextEmail && !sameEmail(before.email, nextEmail)) patch.email = nextEmail;

  const nextPhone = phoneDigits(after.phone);
  if (nextPhone.length >= 10 && nextPhone !== phoneDigits(before.phone)) patch.phone = nextPhone;

  const nextFirst = clean(after.first_name);
  if (nextFirst && nextFirst.toLowerCase() !== clean(before.first_name).toLowerCase()) {
    patch.firstName = nextFirst;
  }
  const nextLast = clean(after.last_name);
  if (nextLast && nextLast.toLowerCase() !== clean(before.last_name).toLowerCase()) {
    patch.lastName = nextLast;
  }

  const nextCity = clean(after.city);
  if (nextCity && nextCity.toLowerCase() !== clean(before.city).toLowerCase()) patch.city = nextCity;
  const nextState = clean(after.state);
  if (nextState && nextState.toLowerCase() !== clean(before.state).toLowerCase()) {
    patch.state = nextState;
  }

  return patch;
}

export type ExtractedResumeSavePlan = {
  workerId: string | null;
  stage: MatchStage | null;
  status: string | null;
  analysis: unknown;
  /** Contact edits never reset progression or discard the saved analysis. */
  resetStage: false;
  contactPatch: ContactFieldPatch;
};

export function planExtractedResumeSave(args: {
  previousText: string;
  nextText: string;
  workerId?: string | null;
  stage?: string | null;
  status?: string | null;
  analysis?: unknown;
}): ExtractedResumeSavePlan {
  return {
    workerId: clean(args.workerId) || null,
    stage: parseMatchStage(args.stage),
    status: args.status ?? null,
    analysis: args.analysis ?? null,
    resetStage: false,
    contactPatch: contactEditsFromExtractedText(args.previousText, args.nextText),
  };
}

/**
 * An email change updates the worker already linked to this analysis.
 * A tenant email owned by someone else is a conflict — never a new candidate
 * and never a relink of this application's analysis.
 */
export function emailChangeTarget(args: {
  currentWorkerId: string;
  conflictingWorkerId?: string | null;
}): { action: "update"; workerId: string } | { action: "conflict" } {
  const current = clean(args.currentWorkerId);
  const conflict = clean(args.conflictingWorkerId);
  if (!current) return { action: "conflict" };
  if (conflict && conflict !== current) return { action: "conflict" };
  return { action: "update", workerId: current };
}
