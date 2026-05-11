"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { FileText } from "lucide-react"
import { isPdfFile } from "@/lib/document-upload-helpers"

const thumbClass =
  "h-20 w-20 shrink-0 rounded-lg border border-[#c5ebe4] bg-gray-50 object-cover"

type Props = {
  /** File selected locally (not yet uploaded) */
  file?: File | null
  /** Full public URL after upload or from cache */
  publicUrl?: string | null
  /** Display / detection name (use full storage path when previewing remote objects) */
  fileName: string
}

/**
 * Thumbnail for identity / document cards: image preview (blob or remote), PDF placeholder, or generic file icon.
 */
export default function DocumentFileThumbnail({ file, publicUrl, fileName }: Props) {
  const [blobPreview, setBlobPreview] = useState<string | null>(null)
  const [remoteOk, setRemoteOk] = useState(true)

  const pdf = isPdfFile(file ?? null, fileName, publicUrl ?? null)

  useEffect(() => {
    let created: string | null = null
    if (file && !pdf) {
      const canBlob =
        file.type.startsWith("image/") ||
        (!file.type && /\.(png|jpe?g|jpeg|webp|gif)$/i.test(file.name || fileName))
      if (canBlob) {
        created = URL.createObjectURL(file)
      }
    }
    setBlobPreview(created)
    return () => {
      if (created) URL.revokeObjectURL(created)
    }
  }, [file, fileName, pdf])

  useEffect(() => {
    setRemoteOk(true)
  }, [publicUrl, fileName])

  if (pdf) {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#c5ebe4] bg-[#ecfffd]">
        <Image src="/icons/pdf-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-[#0f766e]">PDF</span>
      </div>
    )
  }

  if (file && blobPreview) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob: URLs; immediate local preview
      <img src={blobPreview} alt="" className={thumbClass} />
    )
  }

  const remoteSrc = publicUrl ?? ""
  // Try any non-PDF remote URL as an image (paths may lack extension; full URLs may have query params).
  const tryRemoteAsImage = !file && remoteSrc.length > 0 && !pdf

  if (tryRemoteAsImage && remoteOk) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase host; avoid next/image remote config
      <img
        src={remoteSrc}
        alt=""
        className={thumbClass}
        onError={() => setRemoteOk(false)}
      />
    )
  }

  return (
    <div
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100"
      aria-hidden
    >
      <FileText className="h-8 w-8 text-gray-400" />
    </div>
  )
}
