"use client";

import { Bold, HelpCircle, Italic, List, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import { sanitizeJobDescriptionHtml } from "@/lib/jobs/generate-job-description/sanitize-html";

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const JOB_DESCRIPTION_HELP_MESSAGE =
  "Select text, then use Bold, Italic, or Bullet list to format your job description. Clear removes all content so you can start over.";

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function plainTextToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function normalizeEditorHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<br>" || trimmed === "<div><br></div>") return "";
  return html;
}

function stripHtml(value: string): string {
  if (!looksLikeHtml(value)) return value;
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function jobDescriptionPlainText(value: string): string {
  return stripHtml(value ?? "");
}

function JobDescriptionHelpButton({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 280;
    const gap = 8;
    // Prefer opening to the right of the icon; fall back left if needed.
    let left = rect.right + gap;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, rect.left - width - gap);
    }
    const top = Math.max(12, Math.min(rect.top, window.innerHeight - 120));
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-white hover:text-[#64748B]"
        aria-label="Job description formatting help"
        aria-expanded={open}
        aria-describedby={open ? "job-description-help-popover" : undefined}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id="job-description-help-popover"
              role="tooltip"
              style={{ position: "fixed", top: position.top, left: position.left, zIndex: 200 }}
              className="w-[280px] rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-left text-xs leading-5 text-[#475569] shadow-lg"
            >
              {message}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function JobDescriptionEditor({ value, onChange, error }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const [isEmpty, setIsEmpty] = useState(!value?.trim());

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextHtml = !value
      ? ""
      : looksLikeHtml(value)
        ? sanitizeJobDescriptionHtml(value)
        : plainTextToHtml(value);

    // Keep caret stable while typing; only sync when value changed externally.
    if (value === lastEmittedRef.current && editor.innerHTML) {
      return;
    }

    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
    lastEmittedRef.current = value;
    setIsEmpty(!normalizeEditorHtml(nextHtml));
  }, [value]);

  function emitChange() {
    const editor = editorRef.current;
    if (!editor) return;
    const next = normalizeEditorHtml(editor.innerHTML);
    lastEmittedRef.current = next;
    setIsEmpty(!next);
    onChange(next);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const inserted = html.trim()
      ? sanitizeJobDescriptionHtml(html)
      : plainTextToHtml(text);
    if (!inserted) return;
    document.execCommand("insertHTML", false, inserted);
    emitChange();
  }

  function runCommand(command: string, commandValue?: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function clearDescription() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    editor.innerHTML = "";
    lastEmittedRef.current = "";
    setIsEmpty(true);
    onChange("");
  }

  const formatTools = [
    {
      icon: Italic,
      label: "Italic",
      onClick: () => runCommand("italic"),
    },
    {
      icon: Bold,
      label: "Bold",
      onClick: () => runCommand("bold"),
    },
    {
      icon: List,
      label: "Bullet list",
      onClick: () => runCommand("insertUnorderedList"),
    },
  ] as const;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-[#CBD5E1]">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#E5E7EB] bg-[#F8FAFC] px-2 py-2">
          {formatTools.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-white hover:text-[#334155]"
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearDescription}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-white hover:text-[#334155]"
              aria-label="Clear description"
              title="Clear description"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <JobDescriptionHelpButton message={JOB_DESCRIPTION_HELP_MESSAGE} />
          </div>
        </div>

        <div className="relative">
          {isEmpty ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-[#94A3B8]"
            >
              {"About the Role\n\nKey Responsibilities\n• ...\n\nQualifications\n• ..."}
            </div>
          ) : null}
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label="Job description"
            contentEditable
            suppressContentEditableWarning
            className="job-description-editor relative min-h-[320px] cursor-pointer px-3 py-3 text-sm leading-6 text-[#334155] outline-none"
            onInput={emitChange}
            onPaste={handlePaste}
            onBlur={emitChange}
          />
        </div>
      </div>
      {error ? <span className="mt-1 block text-sm text-rose-600">{error}</span> : null}
      <style>{`
        .job-description-editor ul,
        .job-description-html ul {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .job-description-editor ol,
        .job-description-html ol {
          list-style: decimal;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .job-description-editor p,
        .job-description-html p {
          margin: 0 0 0.5rem;
        }
        .job-description-editor b,
        .job-description-editor strong,
        .job-description-html b,
        .job-description-html strong {
          font-weight: 700;
        }
        .job-description-editor i,
        .job-description-editor em,
        .job-description-html i,
        .job-description-html em {
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

export function JobDescriptionHtml({
  html,
  className = "",
  emptyLabel = "—",
}: {
  html: string;
  className?: string;
  emptyLabel?: string;
}) {
  const content = html.trim();
  if (!content) return <p className={className}>{emptyLabel}</p>;

  if (!looksLikeHtml(content)) {
    return <p className={`whitespace-pre-wrap ${className}`}>{content}</p>;
  }

  return (
    <div
      className={`job-description-html max-w-none text-sm leading-6 text-[#334155] ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}