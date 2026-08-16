export type WorkflowPersistAction =
  | { action: "noop" }
  | { action: "fork-preset"; publish: boolean }
  | { action: "create-saved-template"; publish: boolean }
  | { action: "update-template"; templateId: string; publish: boolean }
  | { action: "update-flow"; flowId: string; publish: boolean; saveTemplate: boolean }
  | { action: "tenant-default-flow"; publish: boolean; saveTemplate: boolean };

/**
 * Routes builder save/publish to the correct source of truth.
 * System presets are never mutated; Save as template / Publish forks a tenant copy.
 */
export function resolveWorkflowPersistTarget(input: {
  viewOnly?: boolean;
  editingTemplate: { id: string; isReadOnly: boolean } | null;
  flowId: string | null;
  options: { publish?: boolean; template?: boolean };
}): WorkflowPersistAction {
  if (input.viewOnly) return { action: "noop" };

  const publish = input.options.publish === true;
  const saveTemplate = input.options.template === true;

  if (input.editingTemplate) {
    if (input.editingTemplate.isReadOnly) {
      if (saveTemplate || publish) {
        return { action: "fork-preset", publish };
      }
      return { action: "noop" };
    }
    return {
      action: "update-template",
      templateId: input.editingTemplate.id,
      publish,
    };
  }

  if (input.flowId) {
    return {
      action: "update-flow",
      flowId: input.flowId,
      publish,
      saveTemplate,
    };
  }

  if (saveTemplate) {
    return { action: "create-saved-template", publish };
  }

  return { action: "tenant-default-flow", publish, saveTemplate };
}
