"use client";

import Image from "next/image";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

type RedirectionProgressModalProps = {
  message?: string;
};

export default function RedirectionProgressModal({
  message = "Please wait while we redirecting you to the dashboard...",
}: RedirectionProgressModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[400px] w-[500px] max-w-full flex-col items-center justify-center rounded-3xl bg-white px-[30px] py-[40px] shadow-xl"
      >
        <Image
          src="/loader-logo.svg"
          alt=""
          width={64}
          height={64}
          priority
          className="h-16 w-16 animate-spin object-contain"
        />
        <p className="mt-6 text-center text-[20px] font-medium leading-[28px] text-[#334155]" style={interStyle}>
          {message}
        </p>
      </div>
    </div>
  );
}
