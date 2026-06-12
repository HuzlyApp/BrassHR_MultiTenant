"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Loader2, Pencil, Save } from "lucide-react";
import { useOptionalWorkflowDashboardHeader } from "@/app/admin_recruiter/components/WorkflowDashboardHeaderContext";

const TEXT_PRIMARY = "#101828";
const CARD_BORDER = "#D0D5DD";

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
      className="inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-70"
      style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
      aria-busy={saving}
    >
      {saving ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--brand-primary)" }} />
      ) : (
        <Save size={14} />
      )}
      <span className="hidden sm:inline">{saving ? "Saving…" : "Save as template"}</span>
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
      className="inline-flex h-9 items-center rounded-full border p-0.5"
      style={{ borderColor: CARD_BORDER, backgroundColor: "#F9FAFB" }}
      role="group"
      aria-label="Workflow status"
    >
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
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
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          !isDraft ? "text-white" : "text-[#667085] hover:text-[color:var(--brand-primary)]"
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
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Publish
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
      return { banner: null, center: null, right: null };
    }

    const banner = config.isEditingTemplate ? (
      <p className="text-xs leading-5 text-sky-950">
        <span className="font-semibold">Editing template</span>
        {" — "}
        {config.templateReadOnly
          ? "System preset. Save creates your own copy."
          : "Changes save to this template."}
        {config.statusSuffix ? ` (${config.statusSuffix})` : ""}
      </p>
    ) : config.isDraft ? (
      <p className="text-xs leading-5 text-amber-950">
        <span className="font-semibold">Draft</span>
        {" — "}
        Not live until you publish. Use Test workflow to preview.
        {config.statusSuffix ? ` (${config.statusSuffix})` : ""}
      </p>
    ) : null;

    const center = (
      <div className="flex min-w-0 max-w-full items-center justify-center gap-2">
        {config.editableTitle && editingTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const next = titleDraft.trim() || config.title;
              setEditingTitle(false);
              if (next !== config.title) ctx.onTitleChange?.(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitleDraft(config.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            className="max-w-[min(420px,50vw)] rounded-md border px-2 py-1 text-center text-base font-semibold leading-6 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
            style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
            aria-label="Workflow name"
          />
        ) : (
          <>
            <h1
              className="truncate text-base font-semibold leading-6 sm:text-lg sm:leading-7"
              style={{ color: TEXT_PRIMARY }}
            >
              {config.title}
            </h1>
            {config.editableTitle ? (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#98A2B3] transition hover:bg-[#F9FAFB] hover:text-[color:var(--brand-primary)]"
                aria-label="Edit workflow name"
              >
                <Pencil size={14} />
              </button>
            ) : null}
          </>
        )}
      </div>
    );

    const right = (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={ctx.undo}
          disabled={!ctx.canUndo || config.savingTemplate || config.savingPublish}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
          aria-label="Undo"
        >
          <History size={16} />
        </button>
        <button
          type="button"
          onClick={() => ctx.onPreview?.()}
          disabled={config.savingTemplate || config.savingPublish}
          className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, white)",
            color: "var(--brand-primary)",
          }}
        >
          Test workflow
        </button>
        <SaveTemplateHeaderButton
          saving={config.savingTemplate === true}
          disabled={config.savingPublish}
          onClick={() => ctx.onSaveTemplate?.()}
        />
        {!config.isEditingTemplate ? (
          <DraftPublishToggle
            isDraft={config.isDraft}
            savingPublish={config.savingPublish}
            disabled={config.savingTemplate}
            onPublish={() => ctx.onPublish?.()}
          />
        ) : null}
      </div>
    );

    return { banner, center, right };
  }, [
    config,
    ctx?.canUndo,
    ctx?.onPreview,
    ctx?.onPublish,
    ctx?.onSaveTemplate,
    ctx?.onTitleChange,
    ctx?.undo,
    editingTitle,
    titleDraft,
  ]);
}
