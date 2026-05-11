"use client"

import Image from "next/image"

export default function RightPanel() {
  return (
    <div className="w-1/3 bg-gray-100 flex flex-col items-center justify-center p-6">

      <Image
        src="/images/handshake.jpg"
        alt="Nexus"
        width={250}
        height={250}
        className="rounded-xl mb-4 opacity-80 object-cover"
      />

      <h2 className="font-bold text-teal-700 text-lg">
        NEXUS
      </h2>

      <p className="text-sm text-gray-500 text-center">
        Connecting Healthcare professionals with service providers
      </p>

    </div>
  )
}