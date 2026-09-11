"use client";

import { useEffect, useMemo, useState } from "react";
import type { ServiceAreaAction, PublicServiceAreaDecision } from "@/lib/service-area/types";
import { serviceAreaMessage } from "@/lib/service-area/copy";

type LocationInput = {
  city?: string;
  state?: string;
  postalCode?: string;
  locationType: "onsite" | "hybrid" | "remote";
  relocateToJobSite?: boolean;
  remoteAllowedStates?: string[];
};

export function useServiceAreaPreview(
  location: LocationInput | null,
  action: ServiceAreaAction,
  options?: {
    jobId?: string | null;
    jobToken?: string | null;
    tenantSlug?: string | null;
    publicClient?: boolean;
    enabled?: boolean;
  }
) {
  const [decision, setDecision] = useState<PublicServiceAreaDecision | null>(null);
  const [loading, setLoading] = useState(false);

  const key = useMemo(
    () =>
      JSON.stringify({
        location,
        action,
        jobId: options?.jobId ?? null,
        jobToken: options?.jobToken ?? null,
        tenantSlug: options?.tenantSlug ?? null,
      }),
    [location, action, options?.jobId, options?.jobToken, options?.tenantSlug]
  );

  useEffect(() => {
    if (options?.enabled === false || !location) {
      setDecision(null);
      return;
    }
    const hasEnough =
      location.locationType === "remote"
        ? Boolean(location.remoteAllowedStates?.length || location.state)
        : Boolean(location.state && location.city);
    if (!hasEnough) {
      setDecision(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch("/api/service-area/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          public: options?.publicClient ?? (action === "apply" || action === "signup"),
          jobId: options?.jobId ?? undefined,
          jobToken: options?.jobToken ?? undefined,
          tenantSlug: options?.tenantSlug ?? undefined,
          location,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const payload = (await res.json().catch(() => ({}))) as PublicServiceAreaDecision;
          if (!controller.signal.aborted) setDecision(payload);
        })
        .catch(() => {
          if (!controller.signal.aborted) setDecision(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key, options?.enabled, options?.publicClient, action, location]);

  const allowed = decision?.allowed !== false;
  const message = decision && !decision.allowed ? serviceAreaMessage(decision.messageKey) : null;

  return { decision, loading, allowed, message };
}
