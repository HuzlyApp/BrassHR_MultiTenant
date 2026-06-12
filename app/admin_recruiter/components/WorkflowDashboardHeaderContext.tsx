"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type WorkflowUndoControls = {
  canUndo: boolean;
  undo: () => void;
};

export type WorkflowBuilderHeaderConfig = {
  title: string;
  editableTitle?: boolean;
  isDraft: boolean;
  isEditingTemplate: boolean;
  templateReadOnly?: boolean;
  savingTemplate?: boolean;
  savingPublish?: boolean;
  statusSuffix?: string;
};

type WorkflowDashboardHeaderContextValue = {
  headerConfig: WorkflowBuilderHeaderConfig | null;
  setHeaderConfig: (config: WorkflowBuilderHeaderConfig | null) => void;
  canUndo: boolean;
  undo: () => void;
  setUndoControls: (controls: WorkflowUndoControls | null) => void;
  onTitleChange?: (title: string) => void;
  setOnTitleChange: (handler: ((title: string) => void) | undefined) => void;
  onSaveTemplate?: () => void;
  setOnSaveTemplate: (handler: (() => void) | undefined) => void;
  onPreview?: () => void;
  setOnPreview: (handler: (() => void) | undefined) => void;
  onPublish?: () => void;
  setOnPublish: (handler: (() => void) | undefined) => void;
};

const WorkflowDashboardHeaderContext =
  createContext<WorkflowDashboardHeaderContextValue | null>(null);

function headerConfigEqual(
  a: WorkflowBuilderHeaderConfig | null,
  b: WorkflowBuilderHeaderConfig | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.editableTitle === b.editableTitle &&
    a.isDraft === b.isDraft &&
    a.isEditingTemplate === b.isEditingTemplate &&
    a.templateReadOnly === b.templateReadOnly &&
    a.savingTemplate === b.savingTemplate &&
    a.savingPublish === b.savingPublish &&
    a.statusSuffix === b.statusSuffix
  );
}

export function WorkflowDashboardHeaderProvider({ children }: { children: ReactNode }) {
  const [headerConfig, setHeaderConfigState] = useState<WorkflowBuilderHeaderConfig | null>(
    null
  );
  const [canUndo, setCanUndo] = useState(false);
  const undoRef = useRef<(() => void) | null>(null);
  const onTitleChangeRef = useRef<((title: string) => void) | undefined>(undefined);
  const onSaveTemplateRef = useRef<(() => void) | undefined>(undefined);
  const onPreviewRef = useRef<(() => void) | undefined>(undefined);
  const onPublishRef = useRef<(() => void) | undefined>(undefined);

  const setHeaderConfig = useCallback((config: WorkflowBuilderHeaderConfig | null) => {
    setHeaderConfigState((prev) => (headerConfigEqual(prev, config) ? prev : config));
  }, []);

  const setUndoControls = useCallback((controls: WorkflowUndoControls | null) => {
    undoRef.current = controls?.undo ?? null;
    const nextCanUndo = controls?.canUndo ?? false;
    setCanUndo((prev) => (prev === nextCanUndo ? prev : nextCanUndo));
  }, []);

  const undo = useCallback(() => {
    undoRef.current?.();
  }, []);

  const setOnTitleChange = useCallback((handler: ((title: string) => void) | undefined) => {
    onTitleChangeRef.current = handler;
  }, []);

  const setOnSaveTemplate = useCallback((handler: (() => void) | undefined) => {
    onSaveTemplateRef.current = handler;
  }, []);

  const setOnPreview = useCallback((handler: (() => void) | undefined) => {
    onPreviewRef.current = handler;
  }, []);

  const setOnPublish = useCallback((handler: (() => void) | undefined) => {
    onPublishRef.current = handler;
  }, []);

  const onTitleChange = useCallback((title: string) => {
    onTitleChangeRef.current?.(title);
  }, []);

  const onSaveTemplate = useCallback(() => {
    onSaveTemplateRef.current?.();
  }, []);

  const onPreview = useCallback(() => {
    onPreviewRef.current?.();
  }, []);

  const onPublish = useCallback(() => {
    onPublishRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      headerConfig,
      setHeaderConfig,
      canUndo,
      undo,
      setUndoControls,
      onTitleChange,
      setOnTitleChange,
      onSaveTemplate,
      setOnSaveTemplate,
      onPreview,
      setOnPreview,
      onPublish,
      setOnPublish,
    }),
    [
      canUndo,
      headerConfig,
      onPreview,
      onPublish,
      onSaveTemplate,
      onTitleChange,
      setHeaderConfig,
      setOnPreview,
      setOnPublish,
      setOnSaveTemplate,
      setOnTitleChange,
      setUndoControls,
      undo,
    ]
  );

  return (
    <WorkflowDashboardHeaderContext.Provider value={value}>
      {children}
    </WorkflowDashboardHeaderContext.Provider>
  );
}

export function useWorkflowDashboardHeader() {
  const ctx = useContext(WorkflowDashboardHeaderContext);
  if (!ctx) {
    throw new Error("useWorkflowDashboardHeader must be used within WorkflowDashboardHeaderProvider");
  }
  return ctx;
}

export function useOptionalWorkflowDashboardHeader() {
  return useContext(WorkflowDashboardHeaderContext);
}
