"use client";

import {
  Bold,
  Copy,
  HelpCircle,
  Italic,
  List,
  Trash2,
  ALargeSmall,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  legalPolicyPlainText,
  sanitizeLegalPolicyHtml,
} from "@/lib/legal/policy-html";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

const HELP_MESSAGE =
  "Select text, then use Bold, Italic, Bullet list, or Text size to format the policy. You can paste content from Word or a browser. Copy copies the full policy text.";

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
  return sanitizeLegalPolicyHtml(html);
}

function HelpButton({ message }: { message: string }) {
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
        aria-label="Policy formatting help"
        aria-expanded={open}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
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

export default function LegalPolicyEditor({ value, onChange, disabled = false, error }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const [isEmpty, setIsEmpty] = useState(!value?.trim());

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextHtml = !value
      ? ""
      : looksLikeHtml(value)
        ? sanitizeLegalPolicyHtml(value)
        : plainTextToHtml(value);

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
    if (disabled) return;
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const inserted = html.trim()
      ? sanitizeLegalPolicyHtml(html)
      : plainTextToHtml(text);
    if (!inserted) return;
    document.execCommand("insertHTML", false, inserted);
    emitChange();
  }

  function runCommand(command: string, commandValue?: string) {
    if (disabled) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function changeFontSize(direction: "up" | "down") {
    if (disabled) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand("styleWithCSS", false, "true");
    // Browser fontSize uses 1–7 scale; bump up/down from a mid size.
    document.execCommand("fontSize", false, direction === "up" ? "5" : "2");
    emitChange();
  }

  function clearContent() {
    if (disabled) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    editor.innerHTML = "";
    lastEmittedRef.current = "";
    setIsEmpty(true);
    onChange("");
  }

  async function copyContent() {
    const plain = legalPolicyPlainText(value || editorRef.current?.innerHTML || "");
    if (!plain) {
      toast.error("Nothing to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(plain);
      toast.success("Policy text copied.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
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
      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#CBD5E1]">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#E5E7EB] bg-[#F8FAFC] px-2 py-2">
          {formatTools.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-white hover:text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => changeFontSize("down")}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[#64748B] transition hover:bg-white hover:text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Decrease text size"
            title="Decrease text size"
          >
            <ALargeSmall className="h-4 w-4" />
            <span>A−</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => changeFontSize("up")}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[#64748B] transition hover:bg-white hover:text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Increase text size"
            title="Increase text size"
          >
            <ALargeSmall className="h-4 w-4" />
            <span>A+</span>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void copyContent()}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-white hover:text-[#334155]"
              aria-label="Copy policy text"
              title="Copy"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearContent}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-white hover:text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Clear policy"
              title="Clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <HelpButton message={HELP_MESSAGE} />
          </div>
        </div>

        <div className="relative max-h-[min(55vh,480px)] min-h-[280px] overflow-y-auto overscroll-contain">
          {isEmpty ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-[#94A3B8]"
            >
              {"1. Who We Are\n\nPaste or write your policy content here.\n• Use bullets for lists\n• Select text to bold, italicize, or change size"}
            </div>
          ) : null}
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label="Legal policy content"
            aria-disabled={disabled}
            contentEditable={!disabled}
            suppressContentEditableWarning
            className="legal-policy-editor relative min-h-[280px] cursor-text px-3 py-3 text-sm leading-6 text-[#334155] outline-none disabled:cursor-not-allowed"
            onInput={emitChange}
            onPaste={handlePaste}
            onBlur={emitChange}
          />
        </div>
      </div>
      {error ? <span className="mt-1 block text-sm text-rose-600">{error}</span> : null}
      <style>{`
        .legal-policy-editor ul {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .legal-policy-editor ol {
          list-style: decimal;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .legal-policy-editor p {
          margin: 0 0 0.5rem;
        }
        .legal-policy-editor h2,
        .legal-policy-editor h3 {
          font-weight: 700;
          margin: 0.75rem 0 0.5rem;
        }
        .legal-policy-editor b,
        .legal-policy-editor strong {
          font-weight: 700;
        }
        .legal-policy-editor i,
        .legal-policy-editor em {
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
