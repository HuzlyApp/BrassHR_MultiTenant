"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Loader2, Pencil, Redo2, Save } from "lucide-react";
import { useOptionalWorkflowDashboardHeader } from "@/app/admin_recruiter/components/WorkflowDashboardHeaderContext";

const TEXT_PRIMARY = "#101828";
const CARD_BORDER = "#D0D5DD";

const HEADER_ICON = "h-4 w-4 max-[999px]:h-[9px] max-[999px]:w-[9px]";
const HEADER_BTN_ICON =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-40 max-[999px]:h-6 max-[999px]:w-6 max-[999px]:rounded-md";
const HEADER_ACTION_BTN =
  "inline-flex h-9 items-center rounded-lg border bg-white px-3 text-sm font-medium transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-70 max-[999px]:h-6 max-[999px]:gap-1 max-[999px]:rounded-md max-[999px]:px-2 max-[999px]:text-[11px] leading-none";

function SaveTemplateHeaderButton({
  saving,
  disabled,
  onClick,
}: {
  saving: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || disabled}
      className={HEADER_ACTION_BTN}
      style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
      aria-busy={saving}
      aria-label={saving ? "Saving template" : "Save as template"}
    >
      {saving ? (
        <Loader2 className={`${HEADER_ICON} animate-spin`} style={{ color: "var(--brand-primary)" }} />
      ) : (
        <Save className={HEADER_ICON} />
      )}
      <span className="hidden min-[1000px]:inline">{saving ? "Saving…" : "Save as template"}</span>
    </button>
  );
}

function DraftPublishToggle({
  isDraft,
  savingPublish,
  disabled,
  onPublish,
}: {
  isDraft: boolean;
  savingPublish?: boolean;
  disabled?: boolean;
  onPublish: () => void;
}) {
  return (
    <div
      className="inline-flex h-9 items-center rounded-full border p-0.5 max-[999px]:h-6 max-[999px]:p-0.5"
      style={{ borderColor: CARD_BORDER, backgroundColor: "#F9FAFB" }}
      role="group"
      aria-label="Workflow status"
    >
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors max-[999px]:px-2 max-[999px]:py-0.5 max-[999px]:text-[10px] max-[999px]:leading-none ${
          isDraft ? "text-white" : "text-[#667085]"
        }`}
        style={
          isDraft
            ? {
                background:
                  "linear-gradient(90deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 70%, white) 100%)",
              }
            : undefined
        }
      >
        Draft
      </span>
      <button
        type="button"
        onClick={onPublish}
        disabled={disabled || savingPublish || !isDraft}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 max-[999px]:px-2 max-[999px]:py-0.5 max-[999px]:text-[10px] max-[999px]:leading-none ${
          !isDraft ? "text-white" : "text-[#667085] hover:text-(--brand-primary)"
        }`}
        style={
          !isDraft
            ? {
                background:
                  "linear-gradient(90deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 70%, white) 100%)",
              }
            : undefined
        }
      >
        {savingPublish ? (
          <span className="inline-flex items-center gap-1.5 max-[999px]:gap-0.5">
            <Loader2 className={`${HEADER_ICON} animate-spin`} />
            <span className="max-[999px]:hidden">Publish</span>
          </span>
        ) : (
          "Publish"
        )}
      </button>
    </div>
  );
}

export function useWorkflowBuilderHeaderChrome() {
  const ctx = useOptionalWorkflowDashboardHeader();
  const config = ctx?.headerConfig;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(config?.title ?? "");

  useEffect(() => {
    if (!editingTitle && config?.title) {
      setTitleDraft(config.title);
    }
  }, [config?.title, editingTitle]);

  return useMemo(() => {
    if (!config || !ctx) {
      return { center: null, right: null };
    }

    const center = (
      <div className="flex min-w-0 max-w-full items-center justify-start gap-1.5 min-[1000px]:gap-2">
        {config.editableTitle && editingTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const next = titleDraft.trim();
              setEditingTitle(false);
              if (!next || next === config.title) return;
              void Promise.resolve(ctx.onTitleChange?.(next));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitleDraft(config.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            className="max-w-[min(420px,50vw)] rounded-md border px-2 py-1 text-center text-base font-semibold leading-6 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] max-[999px]:max-w-[38vw] max-[999px]:px-1.5 max-[999px]:py-0.5 max-[999px]:text-xs max-[999px]:leading-4"
            style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
            aria-label="Workflow name"
          />
        ) : (
          <>
            <h1
              className="truncate text-base font-semibold leading-6 min-[1000px]:text-lg min-[1000px]:leading-7 max-[999px]:text-xs max-[999px]:leading-4"
              style={{ color: TEXT_PRIMARY }}
            >
              {config.title}
            </h1>
            {config.editableTitle ? (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#98A2B3] transition hover:bg-[#F9FAFB] hover:text-(--brand-primary) max-[999px]:h-[18px] max-[999px]:w-[18px]"
                aria-label="Edit workflow name"
              >
                <Pencil className={HEADER_ICON} />
              </button>
            ) : null}
          </>
        )}
      </div>
    );

    const right = (
      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1 min-[1000px]:gap-2">
        <button
          type="button"
          onClick={ctx.undo}
          disabled={!ctx.canUndo || config.savingTemplate || config.savingPublish || config.viewOnly}
          className={HEADER_BTN_ICON}
          style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
          aria-label="Undo"
          title="Undo"
        >
          <History className={HEADER_ICON} />
        </button>
        <button
          type="button"
          onClick={ctx.redo}
          disabled={!ctx.canRedo || config.savingTemplate || config.savingPublish || config.viewOnly}
          className={HEADER_BTN_ICON}
          style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
          aria-label="Redo"
          title="Redo"
        >
          <Redo2 className={HEADER_ICON} />
        </button>
        {!config.viewOnly ? (
          <button
            type="button"
            onClick={() => ctx.onPreview?.()}
            disabled={config.savingTemplate || config.savingPublish}
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60 max-[999px]:h-6 max-[999px]:rounded-md max-[999px]:px-2 max-[999px]:text-[11px] max-[999px]:leading-none"
            style={{
              backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, white)",
              color: "var(--brand-primary)",
            }}
          >
            <span className="max-[999px]:hidden">Test workflow</span>
            <span className="hidden max-[999px]:inline">Test</span>
          </button>
        ) : null}
        {!config.viewOnly ? (
          <SaveTemplateHeaderButton
            saving={config.savingTemplate === true}
            disabled={config.savingPublish}
            onClick={() => ctx.onSaveTemplate?.()}
          />
        ) : (
          <span
            className="inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold max-[999px]:h-6 max-[999px]:rounded-md max-[999px]:px-2 max-[999px]:text-[10px] max-[999px]:leading-none"
            style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
          >
            View only
          </span>
        )}
        <DraftPublishToggle
          isDraft={config.isDraft}
          savingPublish={config.savingPublish}
          disabled={config.savingTemplate || config.templateReadOnly || config.viewOnly}
          onPublish={() => ctx.onPublish?.()}
        />
      </div>
    );

    return { center, right };
  }, [
    config,
    ctx?.canUndo,
    ctx?.canRedo,
    ctx?.onPreview,
    ctx?.onPublish,
    ctx?.onSaveTemplate,
    ctx?.onTitleChange,
    ctx?.redo,
    ctx?.undo,
    editingTitle,
    titleDraft,
  ]);
}
