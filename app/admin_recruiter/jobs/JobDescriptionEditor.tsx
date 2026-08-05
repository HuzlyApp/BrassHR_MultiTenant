"use client";

import { Bold, HelpCircle, Italic, List, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  ariaLabel?: string;
  placeholder?: string;
  /**
   * Fixed height for the scrollable editor body (e.g. "h-[280px]").
   * Content scrolls inside; the box does not grow with text.
   */
  bodyHeightClassName?: string;
};

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

export function JobDescriptionEditor({
  value,
  onChange,
  error,
  ariaLabel = "Job description",
  placeholder = "About the Role\n\nKey Responsibilities\n• ...\n\nQualifications\n• ...",
  bodyHeightClassName = "h-[280px]",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const [isEmpty, setIsEmpty] = useState(!value?.trim());

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextHtml = !value
      ? ""
      : looksLikeHtml(value)
        ? value
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

  const tools = [
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
    {
      icon: Trash2,
      label: "Clear description",
      onClick: clearDescription,
    },
  ] as const;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-[#CBD5E1]">
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[#E5E7EB] bg-[#F8FAFC] px-2 py-2">
          {tools.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-white hover:text-[color:var(--brand-secondary)]"
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <span
            className="inline-flex h-8 w-8 cursor-help items-center justify-center rounded-md text-[#94A3B8]"
            title="Select text, then use Bold, Italic, or List"
            aria-label="Formatting help"
          >
            <HelpCircle className="h-4 w-4" />
          </span>
        </div>

        {/* Fixed-height viewport — contentEditable grows inside; this box scrolls. */}
        <div className={`relative ${bodyHeightClassName} overflow-x-hidden overflow-y-auto`}>
          {isEmpty ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[1] whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-[#94A3B8]"
            >
              {placeholder}
            </div>
          ) : null}
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label={ariaLabel}
            contentEditable
            suppressContentEditableWarning
            className="job-description-editor min-h-full cursor-text px-3 py-3 text-sm leading-6 text-[#334155] outline-none"
            onInput={emitChange}
            onBlur={emitChange}
          />
        </div>
      </div>
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
      <style>{`
        .job-description-editor ul,
        .job-description-html ul {
          list-style: disc inside;
          padding-left: 0.15rem;
          margin: 0.75rem 0 1.25rem;
        }
        .job-description-editor ol,
        .job-description-html ol {
          list-style: decimal inside;
          padding-left: 0.15rem;
          margin: 0.75rem 0 1.25rem;
        }
        .job-description-editor li,
        .job-description-html li {
          margin: 0.125rem 0;
          line-height: 1.5;
        }
        .job-description-editor p,
        .job-description-html p {
          margin: 0;
          line-height: 1.6;
        }
        .job-description-editor p + p,
        .job-description-html p + p {
          margin-top: 0.4rem;
        }
        .job-description-editor p:has(> strong:only-child),
        .job-description-html p:has(> strong:only-child) {
          margin-top: 1rem;
          margin-bottom: 0.35rem;
        }
        .job-description-editor > p:has(> strong:only-child):first-child,
        .job-description-html > p:has(> strong:only-child):first-child {
          margin-top: 0;
        }
        .job-description-editor p:has(> br:only-child),
        .job-description-html p:has(> br:only-child),
        .job-description-editor p:empty,
        .job-description-html p:empty {
          display: none;
          margin: 0;
          height: 0;
          overflow: hidden;
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

export {
  JobDescriptionHtml,
  jobDescriptionPlainText,
} from "@/lib/jobs/job-description-html";
