"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Building2, MapPin, Phone, User } from "lucide-react";
import { WorkerPortalPageLoader } from "./WorkerPortalPageLoader";
import type { FacilityListItem, WorkerLocationsResponse } from "@/lib/facilities/types";
import { useApplicantPortalAuthHeaders } from "./useApplicantPortalSession";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "./worker-schedule-typography";

const DETAIL_ICON_CLASS = "mt-0.5 h-5 w-5 shrink-0 text-[#64748B]";

function formatAssignedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function WorkerLocationCard({ facility }: { facility: FacilityListItem }) {
  const assignedDate = formatAssignedDate(facility.assignedAt);

  return (
    <article className={`${WORKER_SCHEDULE_CARD_CLASS} min-w-0 w-full overflow-hidden p-4 shadow-sm sm:p-5`}>
      <div className="mb-4 flex items-start gap-3 border-b border-[#F1F5F9] pb-4 sm:gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
          }}
        >
          <Image
            src="/icons/admin-recruiter/locationfacility.svg"
            alt=""
            width={24}
            height={24}
            className="h-5 w-5 brightness-0 invert sm:h-6 sm:w-6"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-semibold leading-7 text-[#111827] sm:text-xl">
            {facility.name}
          </h2>
          <p className="mt-1 text-sm font-medium text-[#0D9488]">Your work location</p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-[#374151] sm:text-base">
        <div className="flex items-start gap-3">
          <MapPin className={DETAIL_ICON_CLASS} aria-hidden />
          <span className="min-w-0 flex-1 break-words">
            {facility.primaryAddress || "No address on file"}
          </span>
        </div>

        {facility.secondaryAddress ? (
          <div className="flex items-start gap-3">
            <Building2 className={DETAIL_ICON_CLASS} aria-hidden />
            <span className="min-w-0 flex-1 break-words">{facility.secondaryAddress}</span>
          </div>
        ) : null}

        {facility.phone ? (
          <div className="flex items-start gap-3">
            <Phone className={DETAIL_ICON_CLASS} aria-hidden />
            <a
              href={`tel:${facility.phone}`}
              className="min-w-0 flex-1 break-all font-medium text-[#111827] hover:underline"
            >
              {facility.phone}
            </a>
          </div>
        ) : null}

        {facility.contactPerson ? (
          <div className="flex items-start gap-3">
            <User className={DETAIL_ICON_CLASS} aria-hidden />
            <span className="min-w-0 flex-1 break-words">
              <span className="font-medium text-[#111827]">Contact:</span> {facility.contactPerson}
            </span>
          </div>
        ) : null}

        {assignedDate ? (
          <p className="pt-1 text-xs text-[#6B7280] sm:text-sm">
            Assigned on <span className="font-medium text-[#374151]">{assignedDate}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function EmptyLocationsState() {
  return (
    <div
      className={`${WORKER_SCHEDULE_CARD_CLASS} flex min-h-[220px] w-full flex-col items-center justify-center px-4 py-10 text-center sm:min-h-[280px] sm:px-6 sm:py-12`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] sm:h-16 sm:w-16">
        <MapPin className="h-7 w-7 text-[#64748B] sm:h-8 sm:w-8" aria-hidden />
      </div>
      <p className="text-lg font-semibold text-[#111827] sm:text-xl">No assign location</p>
      <p className="mt-2 max-w-md text-sm text-[#6B7280] sm:text-base">
        You do not have a work location yet. Your recruiter will assign one when ready.
      </p>
    </div>
  );
}

export function WorkerLocationsTab() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const [locations, setLocations] = useState<FacilityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Please sign in again.");
        setLocations([]);
        return;
      }

      const res = await fetch("/api/applicant-portal/locations", {
        headers,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as WorkerLocationsResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Could not load locations");
      }

      setLocations(Array.isArray(data.locations) ? data.locations : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load locations");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  if (loading) {
    return <WorkerPortalPageLoader label="Loading locations..." />;
  }

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} max-w-full overflow-x-hidden`}>
      <header className="mb-5 sm:mb-6">
        <h1
          className="text-[24px] font-semibold leading-8 tracking-normal text-black sm:text-[30px] sm:leading-9"
          style={WORKER_SCHEDULE_TITLE_STYLE}
        >
          Locations
        </h1>
        <p
          className={`${WORKER_SCHEDULE_SUBTITLE_CLASS} text-[14px] sm:text-[16px]`}
          style={WORKER_SCHEDULE_SUBTITLE_STYLE}
        >
          Places where you are assigned to work
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:text-base">
          {error}
        </div>
      ) : null}

      {locations.length === 0 ? (
        <EmptyLocationsState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {locations.map((facility) => (
            <WorkerLocationCard key={facility.id} facility={facility} />
          ))}
        </div>
      )}
    </div>
  );
}
