"use client";

import { useEffect, useRef } from "react";

type FirmaTemplateEditorEmbedProps = {
  templateId: string;
  jwt: string;
  embedScriptUrl: string;
  readOnly?: boolean;
  onLoad?: () => void;
  onError?: (message: string) => void;
};

type FirmaTemplateEditorInstance = {
  destroy?: () => void;
};

type FirmaTemplateEditorGlobal = new (options: Record<string, unknown>) => FirmaTemplateEditorInstance;

function getFirmaTemplateEditor(): FirmaTemplateEditorGlobal | undefined {
  return (window as unknown as { FirmaTemplateEditor?: FirmaTemplateEditorGlobal })
    .FirmaTemplateEditor;
}

export default function FirmaTemplateEditorEmbed({
  templateId,
  jwt,
  embedScriptUrl,
  readOnly = false,
  onLoad,
  onError,
}: FirmaTemplateEditorEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FirmaTemplateEditorInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountEditor() {
      if (!containerRef.current) return;

      try {
        if (!getFirmaTemplateEditor()) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(`script[src="${embedScriptUrl}"]`);
            if (existing) {
              resolve();
              return;
            }
            const script = document.createElement("script");
            script.src = embedScriptUrl;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Firma template editor"));
            document.body.appendChild(script);
          });
        }

        const FirmaTemplateEditor = getFirmaTemplateEditor();
        if (cancelled || !containerRef.current || !FirmaTemplateEditor) return;

        editorRef.current?.destroy?.();
        editorRef.current = new FirmaTemplateEditor({
          container: containerRef.current,
          jwt,
          templateId,
          theme: "light",
          readOnly,
          height: "720px",
          width: "100%",
          onLoad,
          onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : "Firma editor error";
            onError?.(message);
          },
        });
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Failed to initialize Firma editor");
      }
    }

    void mountEditor();

    return () => {
      cancelled = true;
      editorRef.current?.destroy?.();
      editorRef.current = null;
    };
  }, [templateId, jwt, embedScriptUrl, readOnly, onLoad, onError]);

  return (
    <div className="overflow-hidden rounded-xl border border-[#EAECF0] bg-white">
      <div ref={containerRef} className="min-h-[720px] w-full" />
    </div>
  );
}
