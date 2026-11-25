"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Render PDFs without depending on a browser's optional native PDF plugin. */
export default function ResumePdfPreview({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    setDocument(null); setPage(1); setLoading(true); setError(null);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/webpack.mjs");
        if (cancelled) return;
        task = pdfjs.getDocument({ url, withCredentials: true });
        const pdf = await task.promise;
        if (!cancelled) setDocument(pdf);
      } catch {
        if (!cancelled) { setError("This PDF could not be displayed. Open or download the resume to view the original file."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; void task?.destroy(); };
  }, [url]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setLoading(true); setError(null);
    void (async () => {
      try {
        const pdfPage = await document.getPage(page);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const width = Math.max(240, (canvas.parentElement?.clientWidth || 800) - 32);
        const viewport = pdfPage.getViewport({ scale: Math.min(width / natural.width, 2) });
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        renderTask = pdfPage.render({ canvas, viewport });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) { setError("This PDF page could not be displayed. Open or download the original resume."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [document, page]);

  return <div className="space-y-3 p-4">
    {document ? <div className="flex items-center justify-center gap-4 text-sm">
      <button type="button" className="rounded border bg-white px-3 py-1 disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Previous page</button>
      <span>Page {page} of {document.numPages}</span>
      <button type="button" className="rounded border bg-white px-3 py-1 disabled:opacity-50" disabled={page >= document.numPages || loading} onClick={() => setPage(value => value + 1)}>Next page</button>
    </div> : null}
    {loading ? <p role="status" className="text-center text-sm">Rendering resume…</p> : null}
    {error ? <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">{error}</p> : null}
    <canvas ref={canvasRef} className="mx-auto h-auto max-w-full bg-white shadow" aria-label={`Resume page ${page}`} hidden={Boolean(error)} />
  </div>;
}
