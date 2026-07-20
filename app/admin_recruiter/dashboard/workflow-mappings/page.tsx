import { Suspense } from "react";
import WorkflowMappingsClient from "./WorkflowMappingsClient";

export default function WorkflowMappingsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-500">Loading workflow mappings…</main>}>
      <WorkflowMappingsClient />
    </Suspense>
  );
}
