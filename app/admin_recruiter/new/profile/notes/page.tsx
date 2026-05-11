"use client";

import Link from "next/link";

export default function NewApplicantProfileNotesDemoPage() {
  return (
    <div className="min-h-screen bg-zinc-50 p-10">
      <div className="max-w-3xl mx-auto bg-white border border-zinc-200 rounded-3xl p-8">
        <div className="text-sm text-gray-600">Profile</div>
        <div className="text-2xl font-semibold text-gray-600 mt-1">Notes</div>
        <div className="text-sm text-gray-600 mt-3">
          Placeholder page so the Profile sub-tabs don’t 404. We can match your Notes screenshot next.
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/admin_recruiter/new/profile"
            className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm hover:bg-zinc-50"
          >
            Back to Details
          </Link>
          <Link
            href="/admin_recruiter/new/profile/resume"
            className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm hover:bg-zinc-50"
          >
            Resume
          </Link>
        </div>
      </div>
    </div>
  );
}

