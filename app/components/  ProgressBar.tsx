export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">

      <div className="flex justify-between text-sm mb-2">
        <span className="text-black">Progress Checklist Tracker</span>
        <span className="text-black">{progress}%</span>
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full">
        <div
          className="h-2 bg-teal-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

    </div>
  )
}