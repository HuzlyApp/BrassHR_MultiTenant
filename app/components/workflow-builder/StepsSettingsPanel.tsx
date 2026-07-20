"use client";

import { ChevronDown, PanelRightClose } from "lucide-react";
import type { Node } from "@xyflow/react";
import {
  BRAND_CTA_GRADIENT,
  CARD_BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./constants";
import type { StepSettings, WorkflowNodeData } from "./types";
import {
  WORKFLOW_DATE_PRIORITY_OPTIONS,
  WORKFLOW_PROVIDER_OPTIONS,
} from "@/lib/onboarding/normalize-workflow-settings";
import { isFirmaAttachableWorkflowStepId } from "@/lib/onboarding/firma-step-settings";
import { FirmaTemplateSelect } from "@/app/components/onboarding/FirmaTemplateSelect";

type StepsSettingsPanelProps = {
  node: Node<WorkflowNodeData> | null;
  onUpdate: (
    id: string,
    patch: Partial<WorkflowNodeData>,
    options?: { skipHistory?: boolean }
  ) => void;
  onSaveStep?: (id: string) => void;
  onCloneWorkflow?: () => void;
  readOnly?: boolean;
  compactMode?: boolean;
  panelOpen?: boolean;
  onPanelClose?: () => void;
};

export default function StepsSettingsPanel({
  node,
  onUpdate,
  onSaveStep,
  onCloneWorkflow,
  readOnly = false,
  compactMode = false,
  panelOpen = true,
  onPanelClose,
}: StepsSettingsPanelProps) {
  if (!compactMode && !panelOpen) {
    return null;
  }

  return (
    <aside
      className={
        compactMode
          ? `flex h-full min-h-0 w-[320px] shrink-0 flex-col border-l bg-[#ECF1F9] fixed inset-y-0 right-0 z-50 shadow-xl transition-transform duration-200 ${
              panelOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`
          : "flex h-full min-h-0 w-[320px] shrink-0 flex-col border-l bg-[#ECF1F9]"
      }
      style={{ borderColor: CARD_BORDER }}
      aria-hidden={!panelOpen ? true : undefined}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-5 py-4"
        style={{ borderColor: CARD_BORDER }}
      >
        {onPanelClose ? (
          <button
            type="button"
            onClick={onPanelClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white transition hover:bg-[#F9FAFB]"
            style={{ borderColor: CARD_BORDER }}
            aria-label="Close steps settings"
          >
            <PanelRightClose size={16} color={TEXT_SECONDARY} />
          </button>
        ) : null}
        <h2 className="text-sm font-semibold leading-5" style={{ color: TEXT_PRIMARY }}>
          Steps Settings
        </h2>
      </div>

      {!node ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-sm" style={{ color: TEXT_SECONDARY }}>
            Select a step from the canvas to edit its settings.
          </p>
        </div>
      ) : (
        <SettingsBody
          key={node.id}
          node={node}
          onUpdate={onUpdate}
          onSaveStep={onSaveStep}
          onCloneWorkflow={onCloneWorkflow}
          readOnly={readOnly}
        />
      )}
    </aside>
  );
}

type SettingsBodyProps = {
  node: NonNullable<StepsSettingsPanelProps["node"]>;
  onUpdate: StepsSettingsPanelProps["onUpdate"];
  onSaveStep?: StepsSettingsPanelProps["onSaveStep"];
  onCloneWorkflow?: StepsSettingsPanelProps["onCloneWorkflow"];
  readOnly?: boolean;
};

function SettingsBody({ node, onUpdate, onSaveStep, onCloneWorkflow, readOnly = false }: SettingsBodyProps) {
  const { settings } = node.data;
  const integrationEnabled = settings.useBraasPartner;
  const providerOptions = integrationEnabled
    ? [...WORKFLOW_PROVIDER_OPTIONS]
    : (["Manual", "Third-party API"] as const);
  const showFirmaTemplatePicker = isFirmaAttachableWorkflowStepId(node.data.stepId);

  const patchSettings = (patch: Partial<StepSettings>, options?: { skipHistory?: boolean }) => {
    onUpdate(node.id, { settings: { ...settings, ...patch } }, options);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white">
          {node.data.icon}
        </span>
        <span
          className="truncate text-sm font-semibold leading-5"
          style={{ color: "#012352" }}
        >
          {node.data.label}
        </span>
      </div>

      <div className={`flex flex-col gap-3 px-5 pb-4 ${readOnly ? "pointer-events-none opacity-60" : ""}`}>
        <TextField
          label="Step title"
          value={node.data.label}
          onChange={(v) => onUpdate(node.id, { label: v }, { skipHistory: true })}
          onCommit={(v) => onUpdate(node.id, { label: v })}
        />
        <TextField
          label="Description"
          value={node.data.description ?? ""}
          onChange={(v) => onUpdate(node.id, { description: v }, { skipHistory: true })}
          onCommit={(v) => onUpdate(node.id, { description: v })}
        />
        {showFirmaTemplatePicker ? (
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "#BC8B41", backgroundColor: "rgba(188, 139, 65, 0.06)" }}
            data-testid="firma-esign-settings"
          >
            <p className="mb-1 text-xs font-semibold" style={{ color: TEXT_PRIMARY }}>
              Firma e-sign (Click and Sign)
            </p>
            <p className="mb-3 text-[11px] leading-4" style={{ color: TEXT_SECONDARY }}>
              Attach a published template so applicants see Click and Sign on Authorizations &amp;
              Documents.
            </p>
            <FirmaTemplateSelect
              value={settings.firmaRecruiterTemplateId ?? ""}
              templateName={settings.firmaRecruiterTemplateName}
              disabled={readOnly}
              onChange={({ id, name }) =>
                patchSettings({
                  firmaRecruiterTemplateId: id,
                  firmaRecruiterTemplateName: name,
                })
              }
            />
          </div>
        ) : null}
        <ToggleRow
          label="Required"
          value={node.data.required}
          onChange={(v) => onUpdate(node.id, { required: v })}
        />
        <SelectField
          label="Phase"
          value={settings.phase}
          options={["pre_hire", "transition", "post_hire"]}
          onChange={(v) =>
            patchSettings({
              phase: (v as StepSettings["phase"]) ?? "pre_hire",
              phaseOrder: v === "transition" ? 2 : v === "post_hire" ? 3 : 1,
            })
          }
        />
        <TextField
          label="Completion owner"
          value={settings.completionOwner ?? ""}
          onChange={(v) => patchSettings({ completionOwner: v }, { skipHistory: true })}
          onCommit={(v) => patchSettings({ completionOwner: v })}
        />
        <ToggleRow
          label="Conditional step"
          value={settings.isConditional === true}
          onChange={(v) => patchSettings({ isConditional: v })}
        />
        <TextField
          label="Unlock condition"
          value={settings.unlockCondition ?? ""}
          onChange={(v) => patchSettings({ unlockCondition: v }, { skipHistory: true })}
          onCommit={(v) => patchSettings({ unlockCondition: v })}
        />
        <ToggleRow
          label="Client performs"
          value={settings.clientPerforms}
          onChange={(v) => patchSettings({ clientPerforms: v })}
        />
        <ToggleRow
          label="Use integration partner"
          value={settings.useBraasPartner}
          onChange={(v) => {
            const next: Partial<StepSettings> = { useBraasPartner: v };
            if (!v && settings.provider === "Checker (connected)") {
              next.provider = "Manual";
            }
            patchSettings(next);
          }}
        />
        <CheckboxRow
          label="Notify HR on fail"
          value={settings.notifyHrOnFail}
          onChange={(v) => patchSettings({ notifyHrOnFail: v })}
        />
      </div>

      <div
        className={`flex flex-col gap-4 border-t px-5 py-4 ${readOnly ? "pointer-events-none opacity-60" : ""}`}
        style={{ borderColor: CARD_BORDER }}
      >
        <SelectField
          label="Date Priority"
          value={settings.datePriority}
          options={[...WORKFLOW_DATE_PRIORITY_OPTIONS]}
          onChange={(v) => patchSettings({ datePriority: v })}
        />
        <SelectField
          label="Provider"
          value={settings.provider}
          options={[...providerOptions]}
          disabled={!integrationEnabled}
          hint={
            integrationEnabled
              ? undefined
              : "Enable “Use integration partner” to use Checker or other connected providers."
          }
          onChange={(v) => patchSettings({ provider: v })}
        />
        <SelectField
          label="Trigger after"
          value={settings.triggerAfter}
          options={["Offer Acceptance", "Document Upload", "Background Check", "Day 1 Start"]}
          onChange={(v) => patchSettings({ triggerAfter: v })}
        />
        <SelectField
          label="Notify"
          value={settings.notify}
          options={["HR + Recruiter", "HR Only", "Manager", "Candidate"]}
          onChange={(v) => patchSettings({ notify: v })}
        />
        <SelectField
          label="Timeline"
          value={settings.timeline}
          options={["1 business day", "3 business days", "5 business days", "10 business days"]}
          onChange={(v) => patchSettings({ timeline: v })}
        />
        <TextField
          label="Conditional Logic"
          value={settings.conditionalLogic}
          onChange={(v) => patchSettings({ conditionalLogic: v }, { skipHistory: true })}
          onCommit={(v) => patchSettings({ conditionalLogic: v })}
        />
      </div>

      {!readOnly ? (
      <div className="mt-auto flex flex-col gap-2.5 border-t px-5 py-4" style={{ borderColor: CARD_BORDER }}>
        <button
          type="button"
          onClick={() => onSaveStep?.(node.id)}
          className="h-10 w-full rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
          style={{ background: BRAND_CTA_GRADIENT }}
        >
          Save Step
        </button>
        <button
          type="button"
          onClick={onCloneWorkflow}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border bg-white text-sm font-semibold transition hover:bg-[#fafafa]"
          style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
        >
          Clone Workflow
        </button>
      </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm leading-5" style={{ color: TEXT_PRIMARY }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative h-[22px] w-10 shrink-0 rounded-full transition"
        style={{ backgroundColor: value ? "#012352" : "#e4e7ec" }}
      >
        <span
          className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
          style={{ left: value ? 20 : 2 }}
        />
      </button>
    </label>
  );
}

function CheckboxRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] rounded border-[#d0d5dd] accent-[#012352]"
      />
      <span className="text-sm leading-5" style={{ color: TEXT_PRIMARY }}>
        {label}
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-medium leading-4"
        style={{ color: TEXT_SECONDARY }}
      >
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          color="#98a2b3"
        />
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-4" style={{ color: TEXT_SECONDARY }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-medium leading-4"
        style={{ color: TEXT_SECONDARY }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit?.(e.target.value)}
        className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25"
        style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
      />
    </div>
  );
}
