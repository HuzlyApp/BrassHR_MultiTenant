"use client";

import { createContext, useContext } from "react";
import type { WorkerAccountOverviewPayload } from "./worker-account-types";

type WorkerAccountContextValue = {
  overview: WorkerAccountOverviewPayload | null;
  updateProfilePhoto: (url: string | null) => void;
};

const WorkerAccountContext = createContext<WorkerAccountContextValue>({
  overview: null,
  updateProfilePhoto: () => undefined,
});

export function WorkerAccountProvider({
  value,
  children,
}: {
  value: WorkerAccountContextValue;
  children: React.ReactNode;
}) {
  return <WorkerAccountContext.Provider value={value}>{children}</WorkerAccountContext.Provider>;
}

export function useWorkerAccountOverview() {
  return useContext(WorkerAccountContext).overview;
}

export function useWorkerAccountActions() {
  return useContext(WorkerAccountContext);
}
