"use client";

import { useEffect, useMemo } from "react";
import { locationFromFreeText } from "@/lib/service-area/normalize";
import { normalizeServiceAreaLocationType } from "@/lib/service-area/location-type";
import { useServiceAreaPreview } from "@/lib/service-area/use-service-area-preview";

type Props = {
  locationText?: string | null;
  postalCode?: string | null;
  locationType?: string | null;
  remoteAllowedStates?: string[] | null;
  onBlockedChange?: (blocked: boolean, message: string | null) => void;
  /** When true, only sync blocked state — do not render the alert message. */
  silent?: boolean;
};

export default function ServiceAreaLocationHint({
  locationText,
  postalCode,
  locationType,
  remoteAllowedStates,
  onBlockedChange,
  silent = false,
}: Props) {
  const parsed = locationFromFreeText(locationText, postalCode);
  const type = normalizeServiceAreaLocationType(locationType) ?? "onsite";
  const location = useMemo(() => {
    if (type === "remote") {
      return {
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        locationType: "remote" as const,
        remoteAllowedStates: remoteAllowedStates ?? [],
      };
    }
    if (!parsed.city || !parsed.state) return null;
    return {
      city: parsed.city,
      state: parsed.state,
      postalCode: parsed.postalCode,
      locationType: type,
    };
  }, [parsed.city, parsed.postalCode, parsed.state, remoteAllowedStates, type]);

  const preview = useServiceAreaPreview(location, "publish_job");

  useEffect(() => {
    onBlockedChange?.(Boolean(preview.message), preview.message);
  }, [onBlockedChange, preview.message]);

  if (silent || !preview.message) return null;

  return (
    <p className="mt-2 text-sm text-[#B91C1C]" role="alert">
      {preview.message}
    </p>
  );
}
