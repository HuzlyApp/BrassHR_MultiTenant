const FIRMA_EMBED_SCRIPT_URL =
  "https://api.firma.dev/functions/v1/embed-proxy/template-editor.js";

let cachedWorkerBlobUrl: string | null = null;
let workerPatchInstalled = false;

function extractFirmaPdfWorkerSource(embedScript: string): string {
  const match = embedScript.match(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/);
  if (!match?.[1]) {
    throw new Error("Could not find Firma PDF worker in embed script");
  }

  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder("utf-8").decode(bytes);
}

async function getFirmaPdfWorkerBlobUrl(embedScriptUrl: string): Promise<string> {
  if (cachedWorkerBlobUrl) return cachedWorkerBlobUrl;

  const response = await fetch(embedScriptUrl);
  if (!response.ok) {
    throw new Error("Failed to download Firma embed script for PDF worker setup");
  }

  const workerSource = extractFirmaPdfWorkerSource(await response.text());
  const blob = new Blob([workerSource], { type: "text/javascript" });
  cachedWorkerBlobUrl = URL.createObjectURL(blob);
  return cachedWorkerBlobUrl;
}

function shouldPatchFirmaPdfWorker(scriptUrl: string): boolean {
  return (
    scriptUrl.startsWith("data:text/javascript") ||
    scriptUrl.includes("pdf.worker") ||
    scriptUrl.endsWith("/pdf.worker.mjs") ||
    scriptUrl.endsWith("pdf.worker.mjs")
  );
}

export function installFirmaPdfWorkerPatch(workerBlobUrl: string): void {
  if (workerPatchInstalled || typeof window === "undefined") return;

  const WorkerConstructor = window.Worker;
  const PatchedWorker = function (
    this: Worker,
    scriptURL: string | URL,
    options?: WorkerOptions
  ) {
    const url = String(scriptURL);
    if (shouldPatchFirmaPdfWorker(url)) {
      return new WorkerConstructor(workerBlobUrl, {
        ...options,
        type: "module",
      });
    }
    return new WorkerConstructor(scriptURL, options);
  } as unknown as typeof Worker;

  PatchedWorker.prototype = WorkerConstructor.prototype;
  window.Worker = PatchedWorker;
  workerPatchInstalled = true;
}

export async function prepareFirmaPdfWorker(embedScriptUrl = FIRMA_EMBED_SCRIPT_URL): Promise<void> {
  const workerBlobUrl = await getFirmaPdfWorkerBlobUrl(embedScriptUrl);
  installFirmaPdfWorkerPatch(workerBlobUrl);
}
