import {
  UPLOAD_RESUME_STEP_KEY,
  UPLOAD_RESUME_TITLE,
  UPLOAD_RESUME_WORKFLOW_STEP_ID,
  isUploadResumeWorkflowStepId,
} from "@/lib/onboarding/enforce-upload-resume-first";
import { normalizeWorkflowNodeSettings } from "@/lib/onboarding/normalize-workflow-settings";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import {
  orderedNodeIds,
  type SerializableWorkflowNode,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";

const CANVAS_X = 120;

function createUploadResumeSerializableNode(
  existingSteps: OnboardingStepDraft[] = [],
  position = { x: CANVAS_X, y: 40 }
): SerializableWorkflowNode {
  const prior = existingSteps.find(
    (s) => s.step_type === "resume_upload" || s.step_key === UPLOAD_RESUME_STEP_KEY
  );
  const nodeId =
    (typeof prior?.metadata?.workflow_node_id === "string" && prior.metadata.workflow_node_id) ||
    `step-${UPLOAD_RESUME_STEP_KEY}`;

  const settings = normalizeWorkflowNodeSettings(
    prior?.metadata?.workflow_settings as SerializableWorkflowNode["settings"] | undefined,
    { required: true, day: 1 }
  );

  return {
    id: nodeId,
    stepId: UPLOAD_RESUME_WORKFLOW_STEP_ID,
    label: prior?.title?.trim() || UPLOAD_RESUME_TITLE,
    description:
      prior?.description?.trim() || "Upload your resume and confirm your contact information.",
    position,
    day: 1,
    required: true,
    settings,
  };
}

function linearEdges(nodeIds: string[]): SerializableWorkflowState["edges"] {
  return nodeIds.slice(0, -1).map((source, index) => {
    const target = nodeIds[index + 1];
    return { id: `e-${source}-${target}`, source, target };
  });
}

/**
 * Ensures Upload Resume exists and is first on the builder canvas without
 * re-inserting other steps the admin removed.
 */
export function enforceUploadResumeFirstInWorkflowState(
  state: SerializableWorkflowState,
  existingSteps: OnboardingStepDraft[] = []
): SerializableWorkflowState {
  const nodes = state.nodes.filter((n) => n.stepId);
  if (!nodes.length) {
    const resume = createUploadResumeSerializableNode(existingSteps);
    return { nodes: [resume], edges: [] };
  }

  const resumeNodes = nodes.filter((n) => isUploadResumeWorkflowStepId(n.stepId));
  const nonResumeNodes = nodes.filter((n) => !isUploadResumeWorkflowStepId(n.stepId));

  const resumeNode =
    resumeNodes[0] ??
    createUploadResumeSerializableNode(existingSteps, nodes[0]?.position ?? { x: CANVAS_X, y: 40 });

  const nonResumeOrder = orderedNodeIds(
    nonResumeNodes,
    state.edges.filter(
      (e) =>
        nonResumeNodes.some((n) => n.id === e.source) &&
        nonResumeNodes.some((n) => n.id === e.target)
    )
  );
  const byId = new Map(nonResumeNodes.map((n) => [n.id, n]));
  const orderedNonResume = nonResumeOrder
    .map((id) => byId.get(id))
    .filter((n): n is SerializableWorkflowNode => Boolean(n));

  const orderedNodes = [resumeNode, ...orderedNonResume];
  const nodeIds = orderedNodes.map((n) => n.id);

  return {
    nodes: orderedNodes,
    edges: linearEdges(nodeIds),
  };
}
