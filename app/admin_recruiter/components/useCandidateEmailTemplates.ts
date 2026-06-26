"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminEmailTemplateItem } from "@/lib/email-templates/types";
import { EMAIL_TEMPLATE_TYPE_LABELS } from "@/lib/email-templates/template-keys";
import { supabaseBrowser } from "@/lib/supabase-browser";

type TemplatePreview = {
  template_key: string;
  template_name: string;
  subject: string;
  body_html: string;
  body_text: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function templateDisplayName(template: AdminEmailTemplateItem): string {
  return (
    EMAIL_TEMPLATE_TYPE_LABELS[
      template.template_key as keyof typeof EMAIL_TEMPLATE_TYPE_LABELS
    ] ?? template.name
  );
}

export function useCandidateEmailTemplates(workerId: string | null) {
  const [templates, setTemplates] = useState<AdminEmailTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const res = await fetch("/api/admin/email-templates", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        templates?: AdminEmailTemplateItem[];
        error?: string;
      };
      if (!res.ok) {
        setTemplates([]);
        setTemplatesError(json.error || `Could not load templates (${res.status})`);
        return;
      }
      setTemplates(json.templates ?? []);
    } catch {
      setTemplates([]);
      setTemplatesError("Could not load email templates.");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const applyTemplate = useCallback(
    async (templateKey: string, targetWorkerId: string) => {
      if (!templateKey || !targetWorkerId) return null;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const origin =
          typeof window !== "undefined" && window.location?.origin
            ? window.location.origin
            : "";
        if (!origin) {
          setPreviewError("Could not detect app URL. Refresh and try again.");
          return null;
        }
        const res = await fetch(
          `/api/admin/candidates/${encodeURIComponent(targetWorkerId)}/communications/email/template-preview?templateKey=${encodeURIComponent(templateKey)}&origin=${encodeURIComponent(origin)}`,
          { cache: "no-store", headers: await authHeaders() }
        );
        const json = (await res.json().catch(() => ({}))) as TemplatePreview & {
          error?: string;
        };
        if (!res.ok) {
          setPreviewError(json.error || `Could not load template (${res.status})`);
          return null;
        }
        setBodyHtml(json.body_html);
        return json;
      } catch {
        setPreviewError("Could not load template preview.");
        return null;
      } finally {
        setPreviewLoading(false);
      }
    },
    []
  );

  const clearTemplate = useCallback(() => {
    setSelectedTemplateKey("");
    setBodyHtml(null);
    setPreviewError(null);
  }, []);

  const resetComposeTemplateState = useCallback(() => {
    clearTemplate();
  }, [clearTemplate]);

  return {
    templates,
    loadingTemplates,
    templatesError,
    selectedTemplateKey,
    setSelectedTemplateKey,
    bodyHtml,
    setBodyHtml,
    previewLoading,
    previewError,
    applyTemplate,
    clearTemplate,
    resetComposeTemplateState,
    templateDisplayName,
  };
}
