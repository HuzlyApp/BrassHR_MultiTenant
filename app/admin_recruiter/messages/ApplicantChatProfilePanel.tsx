"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { nameInitials } from "@/app/admin_recruiter/messages/chat-ui";

type WorkerProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  job_role: string | null;
  status_label: string | null;
  created_at: string | null;
};

type ProfileResponse = {
  worker?: WorkerProfile;
  error?: string;
};

function formatAddress(worker: WorkerProfile): string | null {
  const line1 = worker.address1?.trim();
  const cityLine = [worker.city, worker.state, worker.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const parts = [line1, cityLine].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatSince(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return String(date.getFullYear());
}

export default function ApplicantChatProfilePanel({
  workerId,
  applicantName,
}: {
  workerId: string;
  applicantName: string;
}) {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(workerId)}`, {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as ProfileResponse;
        if (!alive) return;
        setProfile(res.ok ? (payload.worker ?? null) : null);
      } catch {
        if (alive) setProfile(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [workerId]);

  const displayName =
    [profile?.first_name, profile?.last_name]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") || applicantName;
  const address = profile ? formatAddress(profile) : null;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm xl:h-full">
      {loading ? (
        <CandidateDetailLoader label="Loading profile..." className="min-h-0 flex-1 bg-transparent" />
      ) : (
        <>
      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-[30px] pb-[30px]">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-semibold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {nameInitials(displayName)}
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">{displayName}</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            {profile?.job_role?.trim() || "Applicant"}
          </p>
          {profile?.status_label ? (
            <span
              className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: "color-mix(in srgb, var(--brand-accent) 40%, white)",
                color: "var(--brand-secondary)",
              }}
            >
              {profile.status_label}
            </span>
          ) : null}
        </div>

        <div className="mt-4 space-y-4">
          {profile?.email ? (
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
              <div className="min-w-0">
                <p className="break-all text-sm text-[#334155]">{profile.email}</p>
              </div>
            </div>
          ) : null}
          {profile?.phone ? (
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
              <div className="min-w-0">
                <p className="text-sm text-[#334155]">{profile.phone}</p>
              </div>
            </div>
          ) : null}
          {address ? (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
              <div className="min-w-0">
                <p className="text-sm text-[#334155]">{address}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div
            className="rounded-xl px-3 py-3 text-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 22%, white)" }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">Status</p>
            <p className="mt-1 text-sm font-semibold text-[#0F172A]">
              {profile?.status_label || "Applicant"}
            </p>
          </div>
          <div
            className="rounded-xl px-3 py-3 text-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 22%, white)" }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">Since</p>
            <p className="mt-1 text-sm font-semibold text-[#0F172A]">
              {formatSince(profile?.created_at ?? null)}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-[#E8EDF2] px-5 py-5">
        <Link
          href={`/admin_recruiter/workers/${workerId}/profile`}
          className="flex h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold transition hover:brightness-95"
          style={{
            borderColor: "color-mix(in srgb, var(--brand-primary) 35%, #E2E8F0)",
            color: "var(--brand-secondary)",
          }}
        >
          View profile
        </Link>
      </div>
        </>
      )}
    </aside>
  );
}
