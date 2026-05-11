"use client"

import { Dispatch, SetStateAction } from "react"
import DocumentFileThumbnail from "@/app/components/DocumentFileThumbnail"

interface FileUploadBoxProps {
  file: File | null
  setFile: Dispatch<SetStateAction<File | null>>
  accept?: string
  /** Unique id for input/label pair when multiple boxes exist on one page */
  inputId?: string
}

export default function FileUploadBox({ file, setFile, accept, inputId = "file-upload" }: FileUploadBoxProps) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-400 transition-colors">
      <input
        type="file"
        accept={accept || "image/*,.pdf"}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
          }
        }}
        className="hidden"
        id={inputId}
      />
      <label htmlFor={inputId} className="cursor-pointer block">
        {file ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <DocumentFileThumbnail file={file} fileName={file.name} />
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-teal-600 font-medium break-all">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-600 font-medium">Click to upload or drag & drop</p>
            <p className="text-sm text-gray-400">PNG, JPG, PDF up to 10MB</p>
          </div>
        )}
      </label>
    </div>
  )
}
