"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type SaveMailDraftInput = {
  workerId: string;
  subject: string;
  body: string;
  bodyHtml?: string | null;
  templateKey?: string | null;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
}

function hasDraftContent(input: Pick<SaveMailDraftInput, "subject" | "body">): boolean {
  return Boolean(input.subject.trim() || input.body.trim());
}

export function useMailDraftSave(workerId: string | null) {
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<SaveMailDraftInput | null>(null);

  const saveDraft = useCallback(async (input: SaveMailDraftInput, options?: { silent?: boolean }) => {
    if (!input.workerId) return false;
    if (!hasDraftContent(input)) {
      latestRef.current = input;
      return true;
    }

    if (!options?.silent) setDraftSaving(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/admin/mail/drafts", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDraftError(json.error || `Could not save draft (${res.status})`);
        return false;
      }
      setDraftSavedAt(new Date().toISOString());
      return true;
    } catch {
      setDraftError("Could not save draft.");
      return false;
    } finally {
      if (!options?.silent) setDraftSaving(false);
    }
  }, []);

  const queueAutoSave = useCallback(
    (input: SaveMailDraftInput) => {
      latestRef.current = input;
      if (!input.workerId || !hasDraftContent(input)) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void saveDraft(input, { silent: true });
      }, 2000);
    },
    [saveDraft]
  );

  const flushAutoSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const input = latestRef.current;
    if (!input?.workerId) return true;
    if (!hasDraftContent(input)) return true;
    return saveDraft(input, { silent: true });
  }, [saveDraft]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    draftSaving,
    draftSavedAt,
    draftError,
    saveDraft,
    queueAutoSave,
    flushAutoSave,
  };
}
