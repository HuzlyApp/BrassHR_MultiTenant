"use client";

import { useEffect, useLayoutEffect } from "react";
import { useWorkflowDashboardHeader } from "@/app/admin_recruiter/components/WorkflowDashboardHeaderContext";

type BuilderWorkflowHeaderSlotsProps = {
  title: string;
  editableTitle?: boolean;
  onTitleChange?: (title: string) => void;
  isDraft: boolean;
  isEditingTemplate: boolean;
  templateReadOnly?: boolean;
  viewOnly?: boolean;
  savingTemplate?: boolean;
  savingPublish?: boolean;
  statusSuffix?: string;
  onSaveTemplate: () => void;
  onPreview: () => void;
  onPublish: () => void;
};

export default function BuilderWorkflowHeaderSlots({
  title,
  editableTitle = false,
  onTitleChange,
  isDraft,
  isEditingTemplate,
  templateReadOnly = false,
  viewOnly = false,
  savingTemplate = false,
  savingPublish = false,
  statusSuffix,
  onSaveTemplate,
  onPreview,
  onPublish,
}: BuilderWorkflowHeaderSlotsProps) {
  const {
    setHeaderConfig,
    setOnTitleChange,
    setOnSaveTemplate,
    setOnPreview,
    setOnPublish,
  } = useWorkflowDashboardHeader();

  useEffect(() => {
    setOnTitleChange(onTitleChange);
    return () => setOnTitleChange(undefined);
  }, [onTitleChange, setOnTitleChange]);

  useEffect(() => {
    setOnSaveTemplate(onSaveTemplate);
    return () => setOnSaveTemplate(undefined);
  }, [onSaveTemplate, setOnSaveTemplate]);

  useEffect(() => {
    setOnPreview(onPreview);
    return () => setOnPreview(undefined);
  }, [onPreview, setOnPreview]);

  useEffect(() => {
    setOnPublish(onPublish);
    return () => setOnPublish(undefined);
  }, [onPublish, setOnPublish]);

  useLayoutEffect(() => {
    setHeaderConfig({
      title,
      editableTitle,
      isDraft,
      isEditingTemplate,
      templateReadOnly,
      viewOnly,
      savingTemplate,
      savingPublish,
      statusSuffix,
    });
  }, [
    editableTitle,
    isDraft,
    isEditingTemplate,
    savingPublish,
    savingTemplate,
    setHeaderConfig,
    statusSuffix,
    templateReadOnly,
    viewOnly,
    title,
  ]);

  useEffect(() => () => setHeaderConfig(null), [setHeaderConfig]);

  return null;
}
