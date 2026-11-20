"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

type Workspace = { workspaceUrl: string | null; error?: string };

export function LaunchPadCompleteModal({ open, onOpenChange, workspaceUrl, setupComplete = true }: {
  open: boolean;
  workspaceUrl?: string;
  setupComplete?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (workspaceUrl) {
      setWorkspace({ workspaceUrl });
      setError(null);
      return;
    }
    const controller = new AbortController();
    setWorkspace(null);
    setError(null);
    void (async () => {
      try {
        const response = await fetch("/api/admin/launch-pad/domain", { cache: "no-store", signal: controller.signal });
        const data = await response.json() as Workspace;
        if (!response.ok || !data.workspaceUrl) throw new Error(data.error ?? "Could not load your workspace address.");
        setWorkspace(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load your workspace.");
      }
    })();
    return () => controller.abort();
  }, [open, attempt, workspaceUrl]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 text-[#012352] shadow-xl">
          <CheckCircle2 className="mb-4 size-12 text-green-600" aria-hidden="true" />
          <Dialog.Title className="text-2xl font-semibold">{setupComplete ? "Your workspace is ready" : "Your domain is ready"}</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-slate-600">
            {setupComplete ? "Your company setup is complete." : "Your company domain has been saved. You can finish the remaining Launch Pad steps in your workspace."} Open your workspace below and sign in as admin with the email and password you used at signup.
          </Dialog.Description>
          {workspace?.workspaceUrl ? (
            <>
              <p className="my-5 break-all rounded-lg bg-slate-50 p-3 text-sm">{new URL(workspace.workspaceUrl).hostname}{new URL(workspace.workspaceUrl).search}</p>
              <a href={workspace.workspaceUrl} className="inline-flex w-full justify-center rounded-lg bg-[#012352] px-4 py-3 text-sm font-semibold text-white">
                Open my workspace
              </a>
            </>
          ) : error ? (
            <div className="mt-5 space-y-3">
              <p role="alert" className="text-sm text-red-600">{error}</p>
              <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
            </div>
          ) : <p role="status" className="mt-5 text-sm">Loading your workspace address…</p>}
          <Dialog.Close className="absolute right-4 top-4 rounded p-1 text-slate-500" aria-label="Close">
            <X className="size-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
