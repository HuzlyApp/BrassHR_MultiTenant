"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import DetailedCandidateHeader from "../../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../../components/DetailedTabs";
import ProfileSubTabs from "../../../../components/ProfileSubTabs";

type WorkerProfilePayload = {
  worker: {
    first_name: string | null;
    last_name: string | null;
    job_role: string | null;
  };
};

export default function NewApplicantProfileNotesPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WorkerProfilePayload | null>(null);
  const [showNotePopup, setShowNotePopup] = useState(false);

  useEffect(() => {
    async function run() {
      if (!id) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(id)}`);
        const json = (await res.json()) as WorkerProfilePayload;
        if (res.ok) setProfile(json);
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [id]);

  const candidateName = useMemo(() => {
    const n = `${profile?.worker?.first_name ?? ""} ${profile?.worker?.last_name ?? ""}`.trim();
    return n || "John Doe";
  }, [profile?.worker?.first_name, profile?.worker?.last_name]);
  const candidateRole = profile?.worker?.job_role || "Licensed Practical Nurse , LPN";
  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-[1320px] mx-auto">
        <div className="mb-5 text-xs text-gray-600">Admin - New Applicant Detailed Page - Notes</div>

        <DetailedTabs applicantId={id} activeTab="Profile" />

        <DetailedCandidateHeader
          name={candidateName}
          role={candidateRole}
          loading={loading}
        />

        <ProfileSubTabs applicantId={id} activeTab="Notes" />

        <div className="relative mx-auto h-[852px] w-full max-w-[1300px] rounded-md border border-[#E5E7EB] bg-white p-5">
          <div className="flex h-full flex-col items-center justify-center gap-[30px] text-center">
            <div className="flex flex-col items-center gap-3">
              <h2 className="text-[18px] font-semibold leading-7 text-[#111827]">
                You have not created any notes yet
              </h2>
              <p className="max-w-[560px] text-center text-[14px] font-normal leading-5 text-[#6B7280]">
                All notes will be displayed on this page once the first note has been noted.
              </p>
              <Link
                href="#"
                className="text-center text-[14px] font-normal leading-5 text-[#0D9488] hover:underline"
              >
                Learn more about notes
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setShowNotePopup(true)}
              className="inline-flex h-10 w-[124px] items-center justify-center gap-2 rounded-[8px] bg-[#0D9488] px-4 py-[10px] text-sm font-semibold text-white hover:bg-[#0b7f75]"
            >
              <span className="text-[20px] leading-none" aria-hidden="true">
                +
              </span>
              <span>Add Note</span>
            </button>
          </div>

          {showNotePopup ? (
            <div className="absolute bottom-0 right-0 z-20 w-full max-w-[560px] rounded-t-lg border border-zinc-200 bg-white shadow-xl">
              <div className="flex h-10 items-center justify-between rounded-t-lg bg-[#0D9488] px-3">
                <div className="text-sm font-medium text-white">New Note</div>
                <div className="flex items-center gap-2 text-white">
                  <button
                    type="button"
                    onClick={() => setShowNotePopup(false)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15"
                    aria-label="Close note"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotePopup(false)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15"
                    aria-label="Minimize note"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-3">
                <div>
                  <div className="mb-1 text-xs text-[#6B7280]">Relate to</div>
                  <div className="flex h-10 items-center gap-3 rounded border border-[#94A3B8] bg-[#F8FAFC] px-3 text-sm text-[#111827]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(135deg,#27c8c0_0%,#16877f_100%)] text-[12px] font-semibold text-white">
                      JD
                    </span>
                    <span>James Doe</span>
                  </div>
                </div>

                <div className="rounded border border-zinc-200">
                  <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1 text-[#374151]">
                    {[
                      { icon: Bold, label: "Bold" },
                      { icon: Underline, label: "Underline" },
                      { icon: Italic, label: "Italic" },
                      { icon: Strikethrough, label: "Strike" },
                      { icon: List, label: "List" },
                      { icon: ListOrdered, label: "Numbered list" },
                      { icon: AlignLeft, label: "Align left" },
                      { icon: AlignCenter, label: "Align center" },
                      { icon: AlignRight, label: "Align right" },
                      { icon: AlignJustify, label: "Justify" },
                      { icon: Undo2, label: "Undo" },
                      { icon: Redo2, label: "Redo" },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-[#111827] hover:bg-zinc-100"
                        aria-label={item.label}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Add your notes here"
                    className="h-[200px] w-full resize-none p-3 text-sm text-[#111827] placeholder:text-[#94A3B8] outline-none"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0D9488] px-4 text-sm font-semibold text-white hover:bg-[#0b7f75]"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

