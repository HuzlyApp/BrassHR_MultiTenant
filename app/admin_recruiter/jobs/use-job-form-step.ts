"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import type { JobFormStep } from "./job-form-shared";

const STEPS: readonly JobFormStep[] = ["setup", "requisition", "msp-details", "compensation", "description", "review"];

export function jobFormStepFromUrl(search = typeof window !== "undefined" ? window.location.search : ""): JobFormStep | null {
  const value = new URLSearchParams(search).get("step");
  return STEPS.includes(value as JobFormStep) ? (value as JobFormStep) : null;
}

function stepFromUrl(): JobFormStep | null {
  return jobFormStepFromUrl();
}

export function useJobFormStep(initialStep: JobFormStep, ready: boolean) {
  const [step, restoreStep] = useState(initialStep);
  useLayoutEffect(() => {
    if (!ready) return;
    const restore = () => restoreStep(stepFromUrl() ?? initialStep);
    const requestedStep = stepFromUrl();
    if (requestedStep) restoreStep(requestedStep);
    else {
      const url = new URL(window.location.href);
      url.searchParams.set("step", step);
      window.history.replaceState(null, "", url);
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [initialStep, ready, step]);

  const setStep = useCallback((next: JobFormStep) => {
    restoreStep(next);
    const url = new URL(window.location.href);
    if (url.searchParams.get("step") === next) return;
    url.searchParams.set("step", next);
    window.history.pushState(null, "", url);
  }, []);
  return { step, setStep, restoreStep };
}
