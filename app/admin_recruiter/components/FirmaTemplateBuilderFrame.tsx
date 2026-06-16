"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { recruiterTemplateFetch } from "@/app/admin_recruiter/components/recruiter-template-auth";
import type {
  RecruiterTemplateBuilderSession,
  RecruiterTemplateDetail,
} from "@/lib/recruiter-templates/types";

type BuilderFrameProps = {
  templateId: string;
  onTemplateSynced?: (template: RecruiterTemplateDetail) => void;
};

type BuilderSessionResponse = {
  session?: RecruiterTemplateBuilderSession;
  error?: string;
};

type SyncResponse = {
  template?: RecruiterTemplateDetail;
  error?: string;
};

type FirmaEditorMessage = {
  type?: unknown;
  event?: unknown;
  payload?: {
    template_id?: unknown;
    updated_at?: unknown;
    draft?: unknown;
  };
};

type FirmaTemplateEditorInstance = {
  destroy?: () => void;
};

type FirmaTemplateEditorOptions = {
  container: HTMLElement;
  jwt: string;
  templateId: string;
  theme: "light" | "dark";
  readOnly: boolean;
  width: string;
  height: string;
  showCloseButton: boolean;
  onSave: (data: unknown) => void;
  onClose: () => void;
  onError: (error: unknown) => void;
  onLoad: () => void;
};

type FirmaTemplateEditorGlobal =
  | (new (options: FirmaTemplateEditorOptions) => FirmaTemplateEditorInstance)
  | {
      init: (options: FirmaTemplateEditorOptions) => FirmaTemplateEditorInstance;
    };

const FIRMA_EDITOR_EVENTS = new Set(["editor.saved", "editor.published", "editor.closed"]);
const FIRMA_SCRIPT_TIMEOUT_MS = 20000;
const FIRMA_GLOBAL_TIMEOUT_MS = 5000;
const FIRMA_INIT_TIMEOUT_MS = 30000;
const FIRMA_PDF_WORKER_SRC = "https://app.firma.dev/pdf.worker.mjs";
const IS_DEV = process.env.NODE_ENV !== "production";

function getFirmaTemplateEditor(): FirmaTemplateEditorGlobal | undefined {
  return (window as unknown as { FirmaTemplateEditor?: FirmaTemplateEditorGlobal })
    .FirmaTemplateEditor;
}

function hasFirmaInit(
  editor: FirmaTemplateEditorGlobal
): editor is { init: (options: FirmaTemplateEditorOptions) => FirmaTemplateEditorInstance } {
  return typeof (editor as { init?: unknown }).init === "function";
}

function extractUpdatedAt(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const value = (data as { updated_at?: unknown }).updated_at;
  return typeof value === "string" ? value : undefined;
}

function logFirmaBuilderPhase(phase: string, detail?: Record<string, unknown>) {
  if (!IS_DEV) return;
  console.info("[firma-template-builder]", phase, detail ?? {});
}

function configureFirmaPdfWorker(): void {
  const globalWindow = window as unknown as {
    pdfjsLib?: { GlobalWorkerOptions?: { workerSrc?: string } };
  };
  if (globalWindow.pdfjsLib?.GlobalWorkerOptions) {
    globalWindow.pdfjsLib.GlobalWorkerOptions.workerSrc = FIRMA_PDF_WORKER_SRC;
  }
}

function waitForFirmaTemplateEditor(timeoutMs: number): Promise<FirmaTemplateEditorGlobal> {
  const existing = getFirmaTemplateEditor();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const editor = getFirmaTemplateEditor();
      if (editor) {
        window.clearInterval(interval);
        resolve(editor);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(interval);
        reject(new Error("Firma editor script loaded, but did not expose FirmaTemplateEditor"));
      }
    }, 100);
  });
}

async function injectFirmaTemplateEditorScript(src: string): Promise<FirmaTemplateEditorGlobal> {
  const existing = getFirmaTemplateEditor();
  if (existing) {
    configureFirmaPdfWorker();
    return existing;
  }

  document.querySelectorAll<HTMLScriptElement>(`script[src="${src}"]`).forEach((script) => {
    if (!getFirmaTemplateEditor()) script.remove();
  });

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("Timed out loading Firma template editor script"));
    }, FIRMA_SCRIPT_TIMEOUT_MS);

    script.src = src;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      configureFirmaPdfWorker();
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Failed to load Firma template editor script"));
    };
    document.body.appendChild(script);
  });

  return waitForFirmaTemplateEditor(FIRMA_GLOBAL_TIMEOUT_MS);
}

export default function FirmaTemplateBuilderFrame({
  templateId,
  onTemplateSynced,
}: BuilderFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FirmaTemplateEditorInstance | null>(null);
  const initTimeoutRef = useRef<number | null>(null);
  const [session, setSession] = useState<RecruiterTemplateBuilderSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorPhase, setEditorPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expired, setExpired] = useState(false);

  const expectedOrigin = useMemo(() => {
    if (!session?.editor_app_url) return null;
    try {
      return new URL(session.editor_app_url).origin;
    } catch {
      return null;
    }
  }, [session?.editor_app_url]);

  const syncTemplate = useCallback(
    async (input: {
      event?: "editor.saved" | "editor.published" | "editor.closed";
      updated_at?: string;
      draft?: boolean;
    }) => {
      setSyncing(true);
      try {
        const res = await recruiterTemplateFetch(
          `/api/admin/recruiter-templates/${templateId}/sync`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...input,
              firma_template_id: session?.firma_template_id,
            }),
          }
        );
        const body = (await res.json()) as SyncResponse;
        if (!res.ok || !body.template) {
          throw new Error(body.error ?? "Failed to sync Firma template");
        }
        onTemplateSynced?.(body.template);
        if (input.event === "editor.saved") toast.success("Firma template saved");
        if (input.event === "editor.published") toast.success("Firma template published");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to sync Firma template");
      } finally {
        setSyncing(false);
      }
    },
    [onTemplateSynced, session?.firma_template_id, templateId]
  );

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEditorPhase(null);
    try {
      logFirmaBuilderPhase("requesting-builder-session", { templateId });
      const res = await recruiterTemplateFetch(
        `/api/admin/recruiter-templates/${templateId}/builder-session`,
        { method: "POST" }
      );
      const body = (await res.json()) as BuilderSessionResponse;
      if (!res.ok || !body.session) {
        throw new Error(body.error ?? "Failed to start Firma builder session");
      }
      if (!body.session.jwt) {
        throw new Error("Firma builder session did not include an editor token");
      }
      setExpired(false);
      setSession(body.session);
      logFirmaBuilderPhase("builder-session-received", {
        templateId,
        firmaTemplateId: body.session.firma_template_id,
        editorOrigin: new URL(body.session.editor_app_url).origin,
        expiresAt: body.session.expires_at,
      });
      onTemplateSynced?.(body.session.template);
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : "Failed to start Firma builder session");
    } finally {
      setLoading(false);
    }
  }, [onTemplateSynced, templateId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!session?.expires_at) return;
    const delay = new Date(session.expires_at).getTime() - Date.now();
    if (delay <= 0) {
      setExpired(true);
      return;
    }
    const timer = window.setTimeout(() => setExpired(true), delay);
    return () => window.clearTimeout(timer);
  }, [session?.expires_at]);

  useEffect(() => {
    if (!session || !containerRef.current) return;
    const activeSession = session;
    let cancelled = false;

    async function mountEditor() {
      setEditorPhase("Loading Firma editor...");
      setError(null);
      if (initTimeoutRef.current) {
        window.clearTimeout(initTimeoutRef.current);
      }
      initTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        setEditorPhase(null);
        setError("Firma editor did not finish loading.");
        logFirmaBuilderPhase("editor-init-timeout", {
          templateId,
          firmaTemplateId: activeSession.firma_template_id,
        });
      }, FIRMA_INIT_TIMEOUT_MS);

      try {
        logFirmaBuilderPhase("loading-editor-script", {
          scriptOrigin: new URL(activeSession.embed_script_url).origin,
        });
        const FirmaTemplateEditor = await injectFirmaTemplateEditorScript(
          activeSession.embed_script_url
        );
        if (cancelled || !containerRef.current) return;

        setEditorPhase("Initializing Firma editor...");
        editorRef.current?.destroy?.();

        const options: FirmaTemplateEditorOptions = {
          container: containerRef.current,
          jwt: activeSession.jwt,
          templateId: activeSession.firma_template_id,
          theme: "light",
          readOnly: false,
          width: "100%",
          height: "calc(100vh - 220px)",
          showCloseButton: true,
          onSave: (data) => {
            void syncTemplate({ event: "editor.saved", updated_at: extractUpdatedAt(data) });
          },
          onClose: () => {
            void syncTemplate({ event: "editor.closed" });
          },
          onError: (err) => {
            setError(err instanceof Error ? err.message : "Firma editor error");
            setEditorPhase(null);
            if (initTimeoutRef.current) {
              window.clearTimeout(initTimeoutRef.current);
              initTimeoutRef.current = null;
            }
          },
          onLoad: () => {
            setEditorPhase(null);
            if (initTimeoutRef.current) {
              window.clearTimeout(initTimeoutRef.current);
              initTimeoutRef.current = null;
            }
            logFirmaBuilderPhase("editor-onload", {
              templateId,
              firmaTemplateId: activeSession.firma_template_id,
            });
          },
        };

        if (hasFirmaInit(FirmaTemplateEditor)) {
          editorRef.current = FirmaTemplateEditor.init(options);
        } else if (typeof FirmaTemplateEditor === "function") {
          editorRef.current = new FirmaTemplateEditor(options);
        }
        logFirmaBuilderPhase("editor-mounted", {
          templateId,
          firmaTemplateId: activeSession.firma_template_id,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize Firma editor");
        setEditorPhase(null);
        if (initTimeoutRef.current) {
          window.clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
      }
    }

    void mountEditor();

    return () => {
      cancelled = true;
      if (initTimeoutRef.current) {
        window.clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      editorRef.current?.destroy?.();
      editorRef.current = null;
    };
  }, [session, syncTemplate, templateId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      logFirmaBuilderPhase("postmessage-received", {
        origin: event.origin,
        validOrigin: Boolean(expectedOrigin && event.origin === expectedOrigin),
        type:
          event.data && typeof event.data === "object"
            ? (event.data as { type?: unknown }).type
            : typeof event.data,
        event:
          event.data && typeof event.data === "object"
            ? (event.data as { event?: unknown }).event
            : undefined,
      });
      if (!expectedOrigin || event.origin !== expectedOrigin) return;
      const data = event.data as FirmaEditorMessage;
      if (!data || data.type !== "editor.event") return;

      const eventName = typeof data.event === "string" ? data.event : "";
      if (!FIRMA_EDITOR_EVENTS.has(eventName)) return;

      void syncTemplate({
        event: eventName as "editor.saved" | "editor.published" | "editor.closed",
        updated_at:
          typeof data.payload?.updated_at === "string" ? data.payload.updated_at : undefined,
        draft: typeof data.payload?.draft === "boolean" ? data.payload.draft : undefined,
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [expectedOrigin, syncTemplate]);

  if (loading) {
    return (
      <div className="flex min-h-[620px] items-center justify-center border border-[#EAECF0] bg-white text-sm text-[#667085]">
        Starting Firma builder...
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 border border-[#FECACA] bg-[#FEF2F2] p-8 text-center">
        <div>
          <h2 className="text-sm font-semibold text-[#991B1B]">Firma builder unavailable</h2>
          <p className="mt-1 max-w-xl text-sm text-[#7F1D1D]">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshSession()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2 text-sm font-medium text-[#991B1B]"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[720px] flex-col border border-[#EAECF0] bg-white">
      <div className="flex items-center justify-between border-b border-[#EAECF0] px-4 py-3">
        <div className="text-sm text-[#667085]">
          {expired
            ? "Session expired"
            : session
              ? `Session expires ${new Date(session.expires_at).toLocaleString()}`
              : "Firma session"}
        </div>
        <button
          type="button"
          onClick={() => void refreshSession()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054]"
        >
          <RefreshCw className="h-4 w-4" />
          {syncing ? "Syncing" : "Refresh session"}
        </button>
      </div>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          <span>{error}</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshSession()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2 text-sm font-medium text-[#991B1B]"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      ) : null}
      {editorPhase ? (
        <div className="border-b border-[#EAECF0] px-4 py-3 text-sm text-[#667085]">
          {editorPhase}
        </div>
      ) : null}
      <div ref={containerRef} className="min-h-[680px] flex-1" />
    </div>
  );
}
