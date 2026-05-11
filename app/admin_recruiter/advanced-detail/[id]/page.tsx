"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Phone, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  job_role: string | null;
  years_experience: number | null;
  date_of_birth: string | null;
  status_label: string | null;
  created_at: string | null;
  ssn_last_four: string | null;
};

type PagePayload = {
  worker: WorkerProfile;
};

const skillRows = [
  ["Skill & Performance", 5],
  ["Attendance", 4],
  ["Accuracy & Honesty", 5],
  ["Professionalism", 5],
  ["Communication", 5],
  ["Clarity & Conciseness", 5],
  ["Punctuality", 4],
  ["Consistency", 5],
  ["Work Ethics", 5],
  ["Reliability", 5],
] as const;

function formatDate(iso: string | null) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function formatPhone(phone: string | null) {
  if (!phone) return "N/A";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const last = digits.slice(-10);
  return `+1 (${last.slice(0, 3)}) ${last.slice(3, 6)}-${last.slice(6)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default function AdvancedDetailPage() {
  const params = useParams<{ id: string }>();
  const workerId = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);

  useEffect(() => {
    async function run() {
      if (!workerId) return;
      if (!isUuid(workerId)) {
        setError("Invalid worker id");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(workerId)}`);
        const json = (await res.json()) as PagePayload & { error?: string };
        if (!res.ok) {
          throw new Error(json?.error || "Could not load worker");
        }
        setWorker(json.worker);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not load worker";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [workerId]);

  const fullName = useMemo(() => {
    const name = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim();
    return name || "Unknown Worker";
  }, [worker?.first_name, worker?.last_name]);

  const location = useMemo(() => {
    const parts = [worker?.address1, worker?.city, worker?.state].filter(Boolean);
    return parts.length ? parts.join(", ") : "No address";
  }, [worker?.address1, worker?.city, worker?.state]);

  const ageLabel = useMemo(() => {
    if (!worker?.date_of_birth) return "N/A";
    const dob = new Date(worker.date_of_birth);
    if (Number.isNaN(dob.getTime())) return "N/A";
    const ageMs = Date.now() - dob.getTime();
    const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
    return `${age} yr`;
  }, [worker?.date_of_birth]);

  const bioText =
    "Reliable Line Cook with experience in fast-paced kitchens. Skilled in food prep, station setup, and maintaining cleanliness while delivering quality dishes on time. Team-oriented, efficient, and dependable under pressure.";

  return (
    <main className="min-h-screen bg-[#f3f5f5] px-4 py-5 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] rounded-2xl bg-white p-5 lg:p-8">
        <div className="mb-4">
          <Link href="/admin_recruiter/candidates" className="inline-flex items-center text-sm font-medium text-[#1f2937]">
            ← Back
          </Link>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-16 xl:grid-cols-[330px_minmax(0,1fr)]">
          <section>
            <div className="h-[300px] w-full overflow-hidden rounded-2xl bg-slate-200">
              <img src="/images/advanced-detail.png" alt="Worker photo" className="h-full w-full object-cover" />
            </div>

            <h1 className="mt-5 text-[24px] font-semibold leading-normal text-[#101928]">
              {loading ? "Loading..." : fullName}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-[12px] font-semibold leading-normal text-[#101928]">4.5</div>
              <div className="text-[12px] font-semibold leading-normal text-[#667085]">Rating</div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[#0d9488]">
              {[0, 1, 2, 3, 4].map((index) => (
                <Star key={index} className={`h-3.5 w-3.5 ${index === 4 ? "fill-transparent" : "fill-[#0d9488]"}`} />
              ))}
            </div>

            <div className="mt-8 space-y-3 text-base text-[#0d9488]">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[#667085]" />
                <span>{formatPhone(worker?.phone ?? null)}</span>
              </div>
              <div className="flex items-center gap-3">
                <img src="/icons/admin-recruiter/emailicon.svg" alt="" className="h-4 w-4" />
                <span>{worker?.email ?? "No email"}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-[#667085]" />
                <span className="text-[#475467]">{location}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-[#475467]">
              <img src="/icons/admin-recruiter/calendericon.svg" alt="" className="h-4 w-4" />
              <span>
                <span className="font-normal">Joined</span> {formatDate(worker?.created_at ?? null)}
              </span>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#0D9488] bg-white px-4 py-3 text-[12px] font-semibold leading-normal text-[#0D9488]">
                <img src="/icons/admin-recruiter/downloadicon.svg" alt="" className="h-4 w-4" />
                Download CV
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-3 text-[12px] font-semibold leading-normal text-white">
                <img src="/icons/admin-recruiter/chatmesage.svg" alt="" className="h-4 w-4" />
                Message
              </button>
            </div>
          </section>

          <section className="border-t border-[#e4e7ec] pt-6 xl:border-t-0 xl:pt-0">
            <div className="border-b border-[#eaecf0] pb-6">
              <h2 className="text-sm font-semibold text-black">BIO</h2>
              <p className="mt-3 max-w-5xl text-sm leading-5 text-[#4B5563]">{bioText}</p>
            </div>

            <div className="border-b border-[#eaecf0] py-6">
              <h2 className="text-sm font-semibold text-black">GENERAL INFO</h2>
              <div className="mt-4 grid grid-cols-1 gap-y-3 text-[24px] text-[#344054] md:grid-cols-2">
                <div className="flex items-baseline justify-between gap-5  pb-2 pr-6">
                  <span className="text-sm text-[#374151]">Position:</span>
                  <strong className="text-black text-sm font-semibold">{worker?.job_role ?? "General Worker"}</strong>
                </div>
                <div className="flex items-baseline justify-between gap-5  pb-2 pr-6">
                  <span className="text-sm text-[#374151]">Experience:</span>
                  <strong className="text-black text-sm font-semibold">
                    {worker?.years_experience != null ? `${worker.years_experience} yrs` : "N/A"}
                  </strong>
                </div>
                <div className="flex items-baseline justify-between gap-5  pb-2 pr-6">
                  <span className="text-sm text-[#374151]">Worker type:</span>
                  <strong className="text-black text-sm font-semibold">{worker?.status_label ?? "New"}</strong>
                </div>
                <div className="flex items-baseline justify-between gap-5  pb-2 pr-6">
                  <span className="text-sm text-[#374151]">Age:</span>
                  <strong className="text-black text-sm font-semibold">{ageLabel}</strong>
                </div>
                <div className="flex items-baseline justify-between gap-5  pb-2 pr-6">
                  <span className="text-sm text-[#374151]">SS Number:</span>
                  <strong className="text-black text-sm font-semibold">
                    {worker?.ssn_last_four ? `***-**-${worker.ssn_last_four}` : "N/A"}
                  </strong>
                </div>
                <div className="flex items-baseline justify-between gap-5  pb-2 pr-6">
                  <span className="text-sm text-[#374151]">Zip:</span>
                  <strong className="text-black text-sm font-semibold">{worker?.zip ?? "N/A"}</strong>
                </div>
              </div>
            </div>

            <div className="py-6">
              <h2 className="text-sm font-semibold text-black">SKILL ASSESSMENT REVIEWS</h2>
              <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-3 lg:grid-cols-2">
                {skillRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-1 text-[#0d9488]">
                      {[0, 1, 2, 3, 4].map((idx) => (
                        <Star key={`${label}-${idx}`} className={`h-3.5 w-3.5 ${idx < value ? "fill-[#0d9488]" : "fill-transparent"}`} />
                      ))}
                    </div>
                    <div className="min-w-[210px] text-sm font-semibold text-black leading-tight">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[#eaecf0] pt-6">
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#0D9488] bg-white px-6 py-3 text-[12px] font-semibold leading-normal text-[#0D9488]">
            <img src="/icons/admin-recruiter/sendlink.svg" alt="" className="h-4 w-4" />
            Send Invite Link
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-6 py-3 text-[12px] font-semibold leading-normal text-white">
            <img src="/icons/admin-recruiter/claim_candidate.svg" alt="" className="h-4 w-4" />
            Claim Candidate
          </button>
        </div>
      </div>
    </main>
  );
}
