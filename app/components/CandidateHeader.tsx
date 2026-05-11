"use client"

type Worker = {
  first_name?: string
  last_name?: string
  job_role?: string
}

export default function CandidateHeader({ worker }: { worker: Worker }) {
  return (
    <div className="bg-white rounded-xl p-4 flex justify-between items-center shadow-sm">

      {/* LEFT */}
      <div className="flex items-center gap-3">

        {/* AVATAR */}
        <div className="w-10 h-10 rounded-full bg-teal-500 text-white flex items-center justify-center">
          {worker?.first_name?.[0] || "U"}
        </div>

        {/* NAME */}
        <div>
          <div className="font-semibold text-black">
            {worker?.first_name || "-"} {worker?.last_name || ""}
          </div>

          <div className="text-sm text-gray-500">
            {worker?.job_role || "-"}
          </div>
        </div>

      </div>

      {/* BUTTON */}
      <button className="border px-4 py-2 rounded-md text-sm">
        New Applicant
      </button>

    </div>
  )
}