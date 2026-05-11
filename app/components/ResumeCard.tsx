interface ResumeData {
  name: string
  fileName: string
  size: string
}

export default function ResumeCard({ data }: { data: ResumeData }) {

  return (

    <div className="border border-teal-300 bg-teal-50 rounded-lg p-4 flex justify-between items-center">

      <div className="flex items-center gap-3">

        <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center text-white text-xs">
          ✓
        </div>

        <div>

          <p className="text-sm font-semibold text-black">
            {data.fileName}
          </p>

          <p className="text-xs text-gray-500">
            {data.size}
          </p>

        </div>

      </div>

    </div>

  )
}