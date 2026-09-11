"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import {
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  primaryButtonStyle,
} from "./job-form-shared";

type JobTagsModalProps = {
  open: boolean;
  jobTitle: string;
  tags: string[];
  busy?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (tags: string[]) => void;
};

export function JobTagsModal({
  open,
  jobTitle,
  tags,
  busy = false,
  error = null,
  onOpenChange,
  onSave,
}: JobTagsModalProps) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const brandStyle = primaryButtonStyle(brandVars);
  const [draft, setDraft] = useState<string[]>(tags);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(tags);
      setInput("");
    }
  }, [open, tags]);

  function addTag(raw: string) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) return;
    setDraft((current) => {
      if (current.some((item) => item.toLowerCase() === tag.toLowerCase())) return current;
      return [...current, tag].slice(0, 30);
    });
    setInput("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(input.replace(/,/g, ""));
    } else if (event.key === "Backspace" && !input && draft.length) {
      setDraft((current) => current.slice(0, -1));
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[220] bg-black/40" />
        <Dialog.Content
          style={brandVars}
          className="fixed left-1/2 top-1/2 z-[221] flex w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl outline-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-[#0F172A]">Tags</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#64748B]">
                Add or remove tags for{" "}
                <span className="font-medium text-[#334155]">{jobTitle || "this job"}</span>.
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              disabled={busy}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-white transition hover:opacity-90 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>

          <div className="px-5 py-4">
            <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2">
              {draft.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-[#F1F5F9] px-2 py-1 text-xs font-medium text-[#334155]"
                >
                  {tag}
                  <button
                    type="button"
                    disabled={busy}
                    className="text-[#64748B] hover:text-[#0F172A] disabled:opacity-50"
                    aria-label={`Remove ${tag}`}
                    onClick={() =>
                      setDraft((current) => current.filter((item) => item !== tag))
                    }
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              <input
                value={input}
                disabled={busy}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => addTag(input)}
                placeholder={draft.length ? "Add another tag" : "Type a tag and press Enter"}
                className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
              />
            </div>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] px-5 py-4">
            <button
              type="button"
              disabled={busy}
              className={JOB_FORM_OUTLINE_BUTTON_CLASS}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className={JOB_FORM_PRIMARY_BUTTON_CLASS}
              style={brandStyle}
              onClick={() => onSave(draft)}
            >
              {busy ? "Saving…" : "Save tags"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
