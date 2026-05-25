"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  LayoutTemplate,
  Library,
  Menu,
  MoreVertical,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Undo2,
} from "lucide-react";

import SuccessModal from "../SuccessModal";
import StepsCanvas from "./StepsCanvas";
import StepsLibrary from "./StepsLibrary";
import StepsSettingsPanel from "./StepsSettingsPanel";
import {
  CARD_BORDER,
  GOLD_GRADIENT,
  PAGE_BG,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./constants";
import type { StepCategory, WorkflowNodeData, WorkflowState } from "./types";

export type WorkflowBuilderProps = {
  title: string;
  subtitle?: string;
  productName?: string;
  brandName?: string;
  brandTagline?: string;
  stepLibrary: StepCategory[];
  initialNodes?: Node<WorkflowNodeData>[];
  initialEdges?: Edge[];
  lastUpdated?: { author: string; minutesAgo: number };
  onBack?: () => void;
  onChange?: (state: WorkflowState) => void;
  onSaveAsTemplate?: (state: WorkflowState) => void;
  onPreview?: (state: WorkflowState) => void;
  onPublish?: (state: WorkflowState) => void;
  onExportPDF?: (state: WorkflowState) => void;
  onAddTrigger?: () => void;
};

export default function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowBuilderInner({
  title,
  subtitle,
  productName = "Onboarding Builder",
  brandName = "braas HR",
  brandTagline,
  stepLibrary,
  initialNodes = [],
  initialEdges = [],
  lastUpdated,
  onBack,
  onChange,
  onSaveAsTemplate,
  onPreview,
  onPublish,
  onExportPDF,
  onAddTrigger,
}: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<WorkflowNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkflowState[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const currentState: WorkflowState = useMemo(
    () => ({ nodes, edges }),
    [nodes, edges]
  );

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-19), { nodes, edges }]);
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setNodes(last.nodes);
      setEdges(last.edges);
      return prev.slice(0, -1);
    });
  }, [setNodes, setEdges]);

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<WorkflowNodeData>) => {
      pushHistory();
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        )
      );
    },
    [pushHistory, setNodes]
  );

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden"
      style={{ backgroundColor: PAGE_BG }}
    >
      <header
        className="flex h-[60px] shrink-0 items-center justify-between border-b bg-white px-5"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: GOLD_GRADIENT }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 5L12 12L19 5M5 19L12 12L19 19"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-sm font-semibold leading-5"
                style={{ color: TEXT_PRIMARY }}
              >
                {brandName}
              </span>
              {brandTagline ? (
                <span
                  className="text-[10px] leading-3"
                  style={{ color: TEXT_MUTED }}
                >
                  {brandTagline}
                </span>
              ) : null}
            </div>
            <p
              className="text-sm font-semibold leading-5"
              style={{ color: TEXT_PRIMARY }}
            >
              {productName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              color="#98a2b3"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Steps"
              className="h-9 w-[240px] rounded-lg border bg-[#f9fafb] pl-9 pr-3 text-xs outline-none transition focus:border-[#BC8B41] focus:bg-white focus:ring-2 focus:ring-[#BC8B41]/20"
              style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
            />
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition hover:bg-[#fafafa]"
            style={{ borderColor: CARD_BORDER }}
            aria-label="Menu"
          >
            <Menu size={16} color={TEXT_SECONDARY} />
          </button>
        </div>
      </header>

      <div
        className="flex h-[44px] shrink-0 items-center justify-between border-b bg-white px-5"
        style={{ borderColor: CARD_BORDER }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium transition hover:opacity-80"
            style={{ color: TEXT_SECONDARY }}
          >
            <ArrowLeft size={14} />
            Back
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          <ToolbarButton icon={<LayoutTemplate size={14} />} label="Templates" />
          <ToolbarButton icon={<FolderOpen size={14} />} label="My Flows" />
          <ToolbarButton icon={<Library size={14} />} label="Library" />
          <ToolbarButton icon={<Settings size={14} />} label="Settings" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <StepsLibrary categories={stepLibrary} searchTerm={searchTerm} />

        <main className="flex flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
          <div
            className="flex shrink-0 items-center justify-between"
            style={{
              paddingTop: 14,
              paddingBottom: 14,
              paddingLeft: 8,
              paddingRight: 8,
              minHeight: 72,
            }}
          >
            <div className="pl-2">
              <h1
                className="text-lg font-semibold leading-7"
                style={{ color: TEXT_PRIMARY }}
              >
                {title}
              </h1>
              {subtitle ? (
                <p
                  className="mt-0.5 text-xs leading-4"
                  style={{ color: TEXT_SECONDARY }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSaveAsTemplate?.(currentState)}
                className="flex h-9 items-center gap-2 rounded-lg border bg-white px-3.5 text-sm font-medium transition hover:bg-[#fafafa]"
                style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
              >
                <Save size={14} />
                Save as template
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition hover:bg-[#fafafa]"
                style={{ borderColor: CARD_BORDER }}
                aria-label="More options"
              >
                <MoreVertical size={14} color="#98a2b3" />
              </button>
            </div>
          </div>

          <div
            className="relative flex flex-1 flex-col overflow-hidden rounded-2xl"
            style={{
              border: "1.5px dashed #cbd5e1",
              backgroundColor: "#fafafa",
            }}
          >
            <StepsCanvas
              nodes={nodes}
              edges={edges}
              setNodes={setNodes}
              setEdges={setEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              categories={stepLibrary}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />

            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="absolute bottom-4 left-4 z-10 flex h-9 items-center gap-1.5 rounded-full border bg-white px-3.5 text-sm font-medium shadow-sm transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
            >
              <Undo2 size={14} />
              Undo
            </button>

            {lastUpdated ? (
              <p
                className="absolute bottom-4 right-4 z-10 text-xs"
                style={{ color: TEXT_MUTED }}
              >
                Draft <span style={{ color: "#d0d5dd" }}>•</span> Last updated{" "}
                {lastUpdated.minutesAgo}m ago by {lastUpdated.author}
              </p>
            ) : null}
          </div>

          <div
            className="flex shrink-0 items-center justify-between gap-2 border-t bg-white px-5 py-3"
            style={{ borderColor: CARD_BORDER }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAddTrigger}
                className="flex h-10 items-center gap-2 rounded-lg border bg-white px-3.5 text-sm font-medium transition hover:bg-[#fafafa]"
                style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
              >
                <Plus size={14} />
                Add trigger
              </button>
              <button
                type="button"
                onClick={() => onSaveAsTemplate?.(currentState)}
                className="flex h-10 items-center gap-2 rounded-lg border bg-white px-3.5 text-sm font-medium transition hover:bg-[#fafafa]"
                style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
              >
                <Save size={14} />
                Save as template
              </button>
              <button
                type="button"
                onClick={() => onExportPDF?.(currentState)}
                className="flex h-10 items-center gap-2 rounded-lg border bg-white px-3.5 text-sm font-medium transition hover:bg-[#fafafa]"
                style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
              >
                <FileText size={14} />
                Export as PDF
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPreview?.(currentState)}
                className="flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold transition hover:bg-[#fafafa]"
                style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
              >
                <Play size={14} />
                Preview Workflow
              </button>
              <button
                type="button"
                onClick={() => onPublish?.(currentState)}
                className="h-10 rounded-lg px-5 text-sm font-semibold text-white transition hover:brightness-[0.97]"
                style={{ background: GOLD_GRADIENT }}
              >
                Publish to All New Hires
              </button>
            </div>
          </div>
        </main>

        <StepsSettingsPanel
          node={selectedNode}
          onUpdate={handleUpdateNode}
          onSaveStep={() => {
            onChange?.(currentState);
            setSuccessOpen(true);
          }}
        />
      </div>

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success!"
        message="New workflow has been created"
      />
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition hover:bg-[#f9fafb]"
      style={{ color: TEXT_SECONDARY }}
    >
      {icon}
      {label}
    </button>
  );
}
