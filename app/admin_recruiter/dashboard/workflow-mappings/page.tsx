import { Suspense } from "react";
import WorkflowMappingsClient from "./WorkflowMappingsClient";

export default function WorkflowMappingsPage() {
  return (
    <Suspense fallback={<main className="w-full p-5 text-sm text-slate-500 sm:p-8">Loading workflow mappings…</main>}>
      <WorkflowMappingsClient />
    </Suspense>
  );
}
