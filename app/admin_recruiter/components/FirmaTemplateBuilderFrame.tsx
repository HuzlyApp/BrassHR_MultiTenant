"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { recruiterTemplateFetch } from "@/app/admin_recruiter/components/recruiter-template-auth";
import {
  installFirmaEmbeddedTemplateDataPalettePatch,
  patchFirmaTemplateEditorBranding,
  type FirmaTemplateEditorWithPalette,
} from "@/lib/firma/embed-color-palette";
import { prepareFirmaPdfWorker } from "@/lib/firma/pdf-worker-patch";
import {
  applyEditorInitTimeout,
  isAllowedTemplateBuilderMessageOrigin,
  isBuilderSessionExpired,
  msUntilSessionExpiry,
  TEMPLATE_BUILDER_ERRORS,
  TEMPLATE_BUILDER_INIT_TIMEOUT_MS,
  templateBuilderUserMessage,
} from "@/lib/recruiter-templates/builder-frame-lifecycle";
import type {
  RecruiterTemplateBuilderSession,
  RecruiterTemplateDetail,
} from "@/lib/recruiter-templates/types";
import { sanitizeESignatureUserMessage } from "@/lib/e-signature/user-facing";

type BuilderFrameProps = {
  templateId: string;
  onTemplateSynced?: (template: RecruiterTemplateDetail) => void;
};

type BuilderSessionResponse = {
  session?: RecruiterTemplateBuilderSession;
  error?: string;
  correlationId?: string;
  code?: string;
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

type FirmaTemplateEditorInstance = FirmaTemplateEditorWithPalette;

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

function logBuilderPhase(phase: string, detail?: Record<string, unknown>) {
  if (!IS_DEV) return;
  console.info("[e-signature-template-builder]", phase, detail ?? {});
}

function clearFirmaEditorTimer(initTimeoutRef: MutableRefObject<number | null>) {
  if (initTimeoutRef.current) {
    window.clearTimeout(initTimeoutRef.current);
    initTimeoutRef.current = null;
  }
}

function isPdfLoadError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to load pdf") ||
    normalized.includes("document link may have expired") ||
    normalized.includes("file may be corrupted")
  );
}

function createFirmaEditorHost(wrapper: HTMLDivElement): HTMLDivElement {
  const host = document.createElement("div");
  host.className = "min-h-[680px] w-full flex-1";
  wrapper.replaceChildren(host);
  return host;
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
        reject(
          new Error(
            "Signature template editor script loaded, but the editor global was not available"
          )
        );
      }
    }, 100);
  });
}

let scriptLoadPromise: Promise<FirmaTemplateEditorGlobal> | null = null;

async function injectFirmaTemplateEditorScript(src: string): Promise<FirmaTemplateEditorGlobal> {
  const existing = getFirmaTemplateEditor();
  if (existing) return existing;

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = (async () => {
    await prepareFirmaPdfWorker(src);

    const alreadyPresent = getFirmaTemplateEditor();
    if (alreadyPresent) return alreadyPresent;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        script.remove();
        reject(new Error("Timed out loading signature template editor script"));
      }, FIRMA_SCRIPT_TIMEOUT_MS);

      script.src = src;
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        script.remove();
        reject(new Error("Failed to load signature template editor script"));
      };
      document.body.appendChild(script);
    });

    return waitForFirmaTemplateEditor(FIRMA_GLOBAL_TIMEOUT_MS);
  })().finally(() => {
    scriptLoadPromise = null;
  });

  return scriptLoadPromise;
}

export default function FirmaTemplateBuilderFrame({
  templateId,
  onTemplateSynced,
}: BuilderFrameProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FirmaTemplateEditorInstance | null>(null);
  const initTimeoutRef = useRef<number | null>(null);
  const mountGenerationRef = useRef(0);
  const editorReadyRef = useRef(false);
  const pdfRepairAttemptedRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);
  const onTemplateSyncedRef = useRef(onTemplateSynced);
  const [session, setSession] = useState<RecruiterTemplateBuilderSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<"retry" | "refresh" | "rebuild" | "reset" | null>(
    null
  );
  const [editorPhase, setEditorPhase] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expired, setExpired] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [remountNonce, setRemountNonce] = useState(0);

  const expectedOrigin = useMemo(() => {
    if (!session?.editor_app_url) return null;
    try {
      return new URL(session.editor_app_url).origin;
    } catch {
      return null;
    }
  }, [session?.editor_app_url]);

  const editorSessionKey = useMemo(() => {
    if (!session) return null;
    return `${session.firma_template_id}:${session.jwt}:${session.expires_at}:${remountNonce}`;
  }, [session, remountNonce]);

  useEffect(() => {
    onTemplateSyncedRef.current = onTemplateSynced;
  }, [onTemplateSynced]);

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
          throw new Error(body.error ?? "Failed to sync signature template");
        }
        onTemplateSyncedRef.current?.(body.template);
        if (input.event === "editor.saved") toast.success("Signature template saved");
        if (input.event === "editor.published") toast.success("Signature template published");
      } catch (err) {
        toast.error(
          sanitizeESignatureUserMessage(
            err instanceof Error ? err.message : "Failed to sync signature template"
          )
        );
      } finally {
        setSyncing(false);
      }
    },
    [session?.firma_template_id, templateId]
  );

  const requestBuilderSession = useCallback(
    async (options: {
      forceRecreate?: boolean;
      refreshDocument?: boolean;
      preserveOnFailure?: boolean;
    } = {}): Promise<boolean> => {
      if (refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }

      const run = (async (): Promise<boolean> => {
        setSessionLoading(true);
        setError(null);
        setEditorPhase(null);
        setEditorReady(false);
        editorReadyRef.current = false;
        try {
          logBuilderPhase("requesting-builder-session", { templateId, options });
          const res = await recruiterTemplateFetch(
            `/api/admin/recruiter-templates/${templateId}/builder-session`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                force_recreate_firma_template: options.forceRecreate === true,
                refresh_firma_document: options.refreshDocument === true,
              }),
            }
          );
          const body = (await res.json()) as BuilderSessionResponse;
          if (!res.ok || !body.session) {
            throw new Error(
              templateBuilderUserMessage(body.error, res.status, body.correlationId)
            );
          }
          if (!body.session.jwt) {
            throw new Error("Signature template builder session did not include an editor token");
          }
          if (!options.forceRecreate) {
            pdfRepairAttemptedRef.current = false;
          }
          setExpired(isBuilderSessionExpired(body.session.expires_at));
          setSession(body.session);
          logBuilderPhase("builder-session-received", {
            templateId,
            firmaTemplateId: body.session.firma_template_id,
            editorOrigin: new URL(body.session.editor_app_url).origin,
            expiresAt: body.session.expires_at,
          });
          onTemplateSyncedRef.current?.(body.session.template);
          return true;
        } catch (err) {
          if (!options.preserveOnFailure) {
            setSession(null);
          }
          setError(
            templateBuilderUserMessage(
              err instanceof Error
                ? err.message
                : "Failed to start signature template builder session"
            )
          );
          return false;
        } finally {
          setSessionLoading(false);
        }
      })();

      refreshInFlightRef.current = run;
      try {
        return await run;
      } finally {
        if (refreshInFlightRef.current === run) {
          refreshInFlightRef.current = null;
        }
      }
    },
    [templateId]
  );

  const refreshSessionRef = useRef(requestBuilderSession);
  refreshSessionRef.current = requestBuilderSession;

  useEffect(() => {
    void prepareFirmaPdfWorker().catch(() => undefined);
  }, []);

  useEffect(() => {
    void refreshSessionRef.current();
  }, [templateId]);

  useEffect(() => {
    if (!session?.expires_at) return;
    const delay = msUntilSessionExpiry(session.expires_at);
    if (delay <= 0) {
      setExpired(true);
      return;
    }
    const timer = window.setTimeout(() => setExpired(true), delay);
    return () => window.clearTimeout(timer);
  }, [session?.expires_at]);

  const syncTemplateRef = useRef(syncTemplate);
  syncTemplateRef.current = syncTemplate;

  useEffect(() => {
    if (!session || !editorSessionKey) return;
    if (sessionLoading) return;

    const activeSession = session;
    const generation = ++mountGenerationRef.current;
    let cancelled = false;
    editorReadyRef.current = false;
    setEditorReady(false);

    const restoreFetch = activeSession.embed_color_palette
      ? installFirmaEmbeddedTemplateDataPalettePatch(activeSession.embed_color_palette)
      : () => undefined;

    async function mountEditor() {
      // Wait one frame so wrapperRef is attached after sessionLoading flips false.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      if (cancelled || mountGenerationRef.current !== generation) return;

      const activeWrapper = wrapperRef.current;
      if (!activeWrapper) {
        setError(TEMPLATE_BUILDER_ERRORS.ready_timeout);
        return;
      }

      setEditorPhase("Loading signature template editor...");
      setError(null);

      try {
        logBuilderPhase("loading-editor-script", {
          scriptOrigin: new URL(activeSession.embed_script_url).origin,
        });
        const FirmaTemplateEditor = await injectFirmaTemplateEditorScript(
          activeSession.embed_script_url
        );
        if (cancelled || mountGenerationRef.current !== generation) return;

        setEditorPhase("Initializing signature template editor...");
        editorRef.current?.destroy?.();
        const host = createFirmaEditorHost(activeWrapper);
        containerRef.current = host;

        clearFirmaEditorTimer(initTimeoutRef);
        initTimeoutRef.current = window.setTimeout(() => {
          const decision = applyEditorInitTimeout({
            generation,
            activeGeneration: mountGenerationRef.current,
            ready: editorReadyRef.current,
            cancelled,
          });
          if (!decision.shouldSetError) return;
          setEditorPhase(null);
          setError(TEMPLATE_BUILDER_ERRORS.ready_timeout);
          logBuilderPhase("editor-init-timeout", {
            templateId,
            firmaTemplateId: activeSession.firma_template_id,
          });
        }, TEMPLATE_BUILDER_INIT_TIMEOUT_MS);

        const markReady = () => {
          if (cancelled || mountGenerationRef.current !== generation) return;
          editorReadyRef.current = true;
          setEditorReady(true);
          setEditorPhase(null);
          setError(null);
          clearFirmaEditorTimer(initTimeoutRef);
          patchFirmaTemplateEditorBranding(
            editorRef.current,
            activeSession.embed_color_palette
          );
          logBuilderPhase("editor-ready", {
            templateId,
            firmaTemplateId: activeSession.firma_template_id,
          });
        };

        const options: FirmaTemplateEditorOptions = {
          container: host,
          jwt: activeSession.jwt,
          templateId: activeSession.firma_template_id,
          theme: "light",
          readOnly: false,
          width: "100%",
          height: "calc(100vh - 220px)",
          showCloseButton: true,
          onSave: (data) => {
            void syncTemplateRef.current({
              event: "editor.saved",
              updated_at: extractUpdatedAt(data),
            });
          },
          onClose: () => {
            void syncTemplateRef.current({ event: "editor.closed" });
          },
          onError: (err) => {
            if (cancelled || mountGenerationRef.current !== generation) return;
            const message =
              err instanceof Error ? err.message : "Signature template editor error";
            setError(templateBuilderUserMessage(message));
            setEditorPhase(null);
            clearFirmaEditorTimer(initTimeoutRef);
            if (isPdfLoadError(message) && !pdfRepairAttemptedRef.current) {
              pdfRepairAttemptedRef.current = true;
              toast("Refreshing e-signature document and reopening the editor...");
              void refreshSessionRef.current({ refreshDocument: true, preserveOnFailure: true });
            }
          },
          onLoad: markReady,
        };

        if (hasFirmaInit(FirmaTemplateEditor)) {
          editorRef.current = FirmaTemplateEditor.init(options);
        } else if (typeof FirmaTemplateEditor === "function") {
          editorRef.current = new FirmaTemplateEditor(options);
        }
        patchFirmaTemplateEditorBranding(
          editorRef.current,
          activeSession.embed_color_palette
        );
        logBuilderPhase("editor-mounted", {
          templateId,
          firmaTemplateId: activeSession.firma_template_id,
        });
      } catch (err) {
        if (cancelled || mountGenerationRef.current !== generation) return;
        setError(
          templateBuilderUserMessage(
            err instanceof Error ? err.message : "Failed to initialize signature template editor"
          )
        );
        setEditorPhase(null);
        clearFirmaEditorTimer(initTimeoutRef);
      }
    }

    void mountEditor();

    return () => {
      cancelled = true;
      restoreFetch();
      clearFirmaEditorTimer(initTimeoutRef);
      editorRef.current?.destroy?.();
      editorRef.current = null;
      if (containerRef.current && wrapperRef.current) {
        wrapperRef.current.replaceChildren();
      }
      containerRef.current = null;
    };
  }, [editorSessionKey, session, sessionLoading, templateId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      logBuilderPhase("postmessage-received", {
        origin: event.origin,
        validOrigin: isAllowedTemplateBuilderMessageOrigin(event.origin, expectedOrigin),
      });
      if (!isAllowedTemplateBuilderMessageOrigin(event.origin, expectedOrigin)) return;
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

  const runRetry = async () => {
    if (actionBusy) return;
    setActionBusy("retry");
    try {
      setError(null);
      if (session && !isBuilderSessionExpired(session.expires_at)) {
        setEditorReady(false);
        editorReadyRef.current = false;
        setRemountNonce((value) => value + 1);
        return;
      }
      await requestBuilderSession({ preserveOnFailure: true });
    } finally {
      setActionBusy(null);
    }
  };

  const runRefreshSession = async () => {
    if (actionBusy) return;
    setActionBusy("refresh");
    try {
      const ok = await requestBuilderSession({ preserveOnFailure: true });
      if (ok) toast.success("Signing session refreshed");
    } finally {
      setActionBusy(null);
    }
  };

  const runRebuildDocument = async () => {
    if (actionBusy) return;
    setConfirmRebuild(false);
    setActionBusy("rebuild");
    try {
      const ok = await requestBuilderSession({ refreshDocument: true, preserveOnFailure: true });
      if (ok) toast.success("Document rebuilt for the template builder");
    } finally {
      setActionBusy(null);
    }
  };

  const runResetTemplate = async () => {
    if (actionBusy) return;
    setConfirmReset(false);
    setActionBusy("reset");
    try {
      const ok = await requestBuilderSession({ forceRecreate: true });
      if (ok) toast.success("Signature template reset");
    } finally {
      setActionBusy(null);
    }
  };

  const openBuilderWindow = () => {
    if (!session?.editor_url || isBuilderSessionExpired(session.expires_at)) {
      setError(TEMPLATE_BUILDER_ERRORS.session_expired);
      toast.error(TEMPLATE_BUILDER_ERRORS.session_expired);
      return;
    }
    const popup = window.open(session.editor_url, "_blank", "noopener,noreferrer");
    if (!popup) {
      toast.error(
        "The browser blocked the new window. Allow popups for this site, or use the embedded editor."
      );
    }
  };

  const busy = Boolean(actionBusy) || sessionLoading || syncing;

  return (
    <div className="flex min-h-[720px] flex-col border border-[#EAECF0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAECF0] px-4 py-3">
        <div className="text-sm text-[#667085]">
          {sessionLoading
            ? "Starting signature template builder..."
            : expired
              ? "Session expired"
              : session
                ? `Session expires ${new Date(session.expires_at).toLocaleString()}`
                : "E-signature session"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runRefreshSession()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054] disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {actionBusy === "refresh" ? "Refreshing..." : "Refresh session"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmRebuild(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054] disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Rebuild document
          </button>
          <button
            type="button"
            disabled={busy || !session || expired}
            onClick={openBuilderWindow}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054] disabled:opacity-50"
          >
            Open signature template builder
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          <span>{error}</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runRetry()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2 text-sm font-medium text-[#991B1B] disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              {actionBusy === "retry" ? "Retrying..." : "Retry"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runRefreshSession()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2 text-sm font-medium text-[#991B1B] disabled:opacity-50"
            >
              Refresh session
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2 text-sm font-medium text-[#991B1B] disabled:opacity-50"
            >
              Reset signature template
            </button>
          </div>
        </div>
      ) : null}

      {editorPhase && !editorReady ? (
        <div className="border-b border-[#EAECF0] px-4 py-3 text-sm text-[#667085]">
          {editorPhase}
        </div>
      ) : null}

      <div ref={wrapperRef} className="relative min-h-[680px] flex-1">
        {sessionLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-[#667085]">
            Starting signature template builder...
          </div>
        ) : null}
        {!session && !sessionLoading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div>
              <h2 className="text-sm font-semibold text-[#991B1B]">
                Signature template builder unavailable
              </h2>
              <p className="mt-1 max-w-xl text-sm text-[#7F1D1D]">
                {error ?? TEMPLATE_BUILDER_ERRORS.unknown}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runRetry()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2 text-sm font-medium text-[#991B1B] disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {confirmRebuild ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#101828]">Rebuild document?</h3>
            <p className="mt-2 text-sm text-[#667085]">
              This re-uploads the source document to the e-signature service when the provider
              document is missing or incompatible. Placed signature fields may be affected. Your
              local source file is preserved.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRebuild(false)}
                className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runRebuildDocument()}
                className="rounded-lg bg-[#B42318] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Rebuild document
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#101828]">Reset signature template?</h3>
            <p className="mt-2 text-sm text-[#667085]">
              This recreates the provider-side signature template. Placed signature fields will be
              removed. The local source document and template metadata are preserved. Use only after
              Retry and Refresh session fail.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runResetTemplate()}
                className="rounded-lg bg-[#B42318] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reset signature template
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
