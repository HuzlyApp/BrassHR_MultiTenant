"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { interStyle } from "./constants";

export function DomainSuccessModal({
  open,
  domainLabel,
  onClose,
}: {
  open: boolean;
  domainLabel: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!domainLabel) return;
    try {
      await navigator.clipboard.writeText(domainLabel);
      setCopied(true);
      toast.success("Domain link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-32px)] max-w-[500px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-xl outline-none"
          aria-describedby="domain-success-description"
        >
          <div className="flex items-center justify-end px-4 pt-3">
            <Dialog.Close
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC]"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex flex-col items-center px-8 pb-8 pt-1 text-center">
            <div
              className="mb-6 flex size-[74px] items-center justify-center rounded-full bg-[#012352] text-white"
              aria-hidden
            >
              <Check className="size-8" strokeWidth={2.5} />
            </div>

            <Dialog.Title className="text-[24px] font-semibold leading-8 text-black" style={interStyle}>
              Success!
            </Dialog.Title>
            <Dialog.Description
              id="domain-success-description"
              className="mt-2 max-w-[370px] text-[14px] leading-5 text-[#6B7280]"
              style={interStyle}
            >
              You successfully setup your new domain. Please check your email to login or copy the url
              link below.
            </Dialog.Description>

            <div className="mt-6 flex w-full max-w-[342px] items-stretch overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
              <p
                className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[14px] text-[#0F172A]"
                style={interStyle}
                title={domainLabel}
              >
                {domainLabel || "—"}
              </p>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex w-[42px] shrink-0 cursor-pointer items-center justify-center border-l border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#012352]"
                aria-label={copied ? "Copied" : "Copy domain link"}
              >
                {copied ? <Check className="size-3.5 text-[#16A34A]" /> : <Copy className="size-3.5" />}
              </button>
            </div>

            <p className="mt-6 max-w-[356px] text-[13px] leading-5 text-[#6B7280]" style={interStyle}>
              Please take note that once you logout, this old domain can no longer be used.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
