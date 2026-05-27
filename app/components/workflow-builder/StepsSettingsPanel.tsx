"use client";

import { ChevronDown } from "lucide-react";
import type { Node } from "@xyflow/react";
import {
  CARD_BORDER,
  GOLD_GRADIENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./constants";
import type { StepSettings, WorkflowNodeData } from "./types";

type StepsSettingsPanelProps = {
  node: Node<WorkflowNodeData> | null;
  onUpdate: (id: string, patch: Partial<WorkflowNodeData>) => void;
  onSaveStep?: (id: string) => void;
  onCloneWorkflow?: () => void;
};

export default function StepsSettingsPanel({
  node,
  onUpdate,
  onSaveStep,
  onCloneWorkflow,
}: StepsSettingsPanelProps) {
  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col border-l bg-[#ECF1F9]"
      style={{ borderColor: CARD_BORDER }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: CARD_BORDER }}
      >
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
          node={node}
          onUpdate={onUpdate}
          onSaveStep={onSaveStep}
          onCloneWorkflow={onCloneWorkflow}
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
};

function SettingsBody({ node, onUpdate, onSaveStep, onCloneWorkflow }: SettingsBodyProps) {
  const patchSettings = (patch: Partial<StepSettings>) => {
    onUpdate(node.id, {
      settings: { ...node.data.settings, ...patch },
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
          // style={{ backgroundColor: color.header }}
        >
          {node.data.icon}
        </span>
        <span
          className="truncate text-sm font-semibold leading-5"
          style={{ color: "#012352" }}
        >
          {node.data.label}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-4">
        <TextField
          label="Step title"
          value={node.data.label}
          onChange={(v) => onUpdate(node.id, { label: v })}
        />
        <TextField
          label="Description"
          value={node.data.description ?? ""}
          onChange={(v) => onUpdate(node.id, { description: v })}
        />
        <ToggleRow
          label="Required"
          value={node.data.required}
          onChange={(v) => {
            onUpdate(node.id, { required: v });
            patchSettings({ required: v });
          }}
        />
        <ToggleRow
          label="Client performs"
          value={node.data.settings.clientPerforms}
          onChange={(v) => patchSettings({ clientPerforms: v })}
        />
        <ToggleRow
          label="Use integration partner"
          value={node.data.settings.useBraasPartner}
          onChange={(v) => patchSettings({ useBraasPartner: v })}
        />
        <CheckboxRow
          label="Notify HR on fail"
          value={node.data.settings.notifyHrOnFail}
          onChange={(v) => patchSettings({ notifyHrOnFail: v })}
        />
      </div>

      <div className="flex flex-col gap-4 border-t px-5 py-4" style={{ borderColor: CARD_BORDER }}>
        <SelectField
          label="Date Priority"
          value={node.data.settings.datePriority}
          options={["Day 1", "Day 2", "Day 3", "Day 5", "Day 7"]}
          onChange={(v) => {
            patchSettings({ datePriority: v });
            const dayMatch = /Day (\d+)/.exec(v);
            if (dayMatch) onUpdate(node.id, { day: Number(dayMatch[1]) });
          }}
        />
        <SelectField
          label="Provider"
          value={node.data.settings.provider}
          options={["Checker (connected)", "Manual", "Third-party API"]}
          onChange={(v) => patchSettings({ provider: v })}
        />
        <SelectField
          label="Trigger after"
          value={node.data.settings.triggerAfter}
          options={["Offer Acceptance", "Document Upload", "Background Check", "Day 1 Start"]}
          onChange={(v) => patchSettings({ triggerAfter: v })}
        />
        <SelectField
          label="Notify"
          value={node.data.settings.notify}
          options={["HR + Recruiter", "HR Only", "Manager", "Candidate"]}
          onChange={(v) => patchSettings({ notify: v })}
        />
        <SelectField
          label="Timeline"
          value={node.data.settings.timeline}
          options={["1 business day", "3 business days", "5 business days", "10 business days"]}
          onChange={(v) => patchSettings({ timeline: v })}
        />
        <TextField
          label="Conditional Logic"
          value={node.data.settings.conditionalLogic}
          onChange={(v) => patchSettings({ conditionalLogic: v })}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2.5 border-t px-5 py-4" style={{ borderColor: CARD_BORDER }}>
        <button
          type="button"
          onClick={() => onSaveStep?.(node.id)}
          className="h-10 w-full rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
          style={{ background: GOLD_GRADIENT }}
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
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
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
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25"
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
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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
        className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/25"
        style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
      />
    </div>
  );
}
