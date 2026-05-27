export type StepColorKey =
  | "navy"
  | "purple"
  | "green"
  | "pink"
  | "amber"
  | "teal"
  | "rose"
  | "indigo"
  | "slate"
  | "denimBlue"
  | "pureBlue"
  | "royalPurple"
  | "amberGold"
  | "brightRose"
  | "limeGreen"
  | "slateGray"
  | "electricBlue"
  | "pastelPink"
  | "safetyOrange"
  | "neonCyan"
  | "emeraldGreen"
  | "tealNew";

export type StepDefinition = {
  id: string;
  label: string;
  icon: React.ReactNode;
  // color: StepColorKey;
  description?: string;
};

export type StepCategory = {
  id: string;
  label: string;
  steps: StepDefinition[];
};

export type StepSettings = {
  required: boolean;
  clientPerforms: boolean;
  useBraasPartner: boolean;
  notifyHrOnFail: boolean;
  datePriority: string;
  provider: string;
  triggerAfter: string;
  notify: string;
  timeline: string;
  conditionalLogic: string;
};

export type WorkflowNodeData = {
  stepId: string;
  label: string;
  description?: string | null;
  icon: React.ReactNode;
  day: number;
  required: boolean;
  settings: StepSettings;
  onDelete?: (id: string) => void;
  onAddNext?: (id: string) => void;
  [key: string]: unknown;
};

export type WorkflowState = {
  nodes: import("@xyflow/react").Node<WorkflowNodeData>[];
  edges: import("@xyflow/react").Edge[];
};

export const DEFAULT_STEP_SETTINGS: StepSettings = {
  required: true,
  clientPerforms: true,
  useBraasPartner: true,
  notifyHrOnFail: true,
  datePriority: "Day 1",
  provider: "Checker (connected)",
  triggerAfter: "Offer Acceptance",
  notify: "HR + Recruiter",
  timeline: "5 business days",
  conditionalLogic: "If result = fail → Pause flow + notify",
};
