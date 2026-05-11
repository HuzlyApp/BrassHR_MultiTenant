"use client"

type SubItem = {
  file_name?: string
}

type ChecklistItem = {
  label: string
  status: "pending" | "complete"
  subItems?: SubItem[]
}

type Props = {
  title: string
  items: ChecklistItem[]
}

export default function ChecklistCard({ title, items }: Props) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">

      {/* HEADER */}
      <div className="flex justify-between mb-4">
        <h2 className="font-semibold text-black">{title}</h2>

        <button className="text-xs border px-3 py-1 rounded-md">
          Details
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-4">

        {items.map((item, i) => (
          <div key={i}>

            {/* MAIN ROW */}
            <div className="flex justify-between text-sm">
              <span className="text-black">{item.label}</span>

              <span
                className={`text-xs px-2 py-1 rounded ${
                  item.status === "complete"
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.status}
              </span>
            </div>

            {/* SUB ITEMS */}
            {item.subItems && item.subItems.length > 0 && (
              <div className="ml-4 mt-2 space-y-1 text-xs">

                {item.subItems.map((sub, j) => (
                  <div key={j} className="flex justify-between">

                    <span className="text-black">
                      {sub.file_name || "File"}
                    </span>

                    <span className="text-green-500">
                      Uploaded
                    </span>

                  </div>
                ))}

              </div>
            )}

          </div>
        ))}

      </div>
    </div>
  )
}