"use client";

import { createContext, useContext } from "react";
import type { WorkerAccountOverviewPayload, WorkerAccountTab } from "./worker-account-types";
import { workerAccountTabHref } from "./worker-account-types";

type WorkerAccountContextValue = {
  overview: WorkerAccountOverviewPayload | null;
  updateProfilePhoto: (url: string | null) => void;
  refreshOverview: () => Promise<void>;
  readOnly: boolean;
  tabHref: (tab: WorkerAccountTab) => string;
};

const WorkerAccountContext = createContext<WorkerAccountContextValue>({
  overview: null,
  updateProfilePhoto: () => undefined,
  refreshOverview: async () => undefined,
  readOnly: false,
  tabHref: workerAccountTabHref,
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
  const { updateProfilePhoto, refreshOverview } = useContext(WorkerAccountContext);
  return { updateProfilePhoto, refreshOverview };
}

export function useWorkerAccountReadOnly() {
  return useContext(WorkerAccountContext).readOnly;
}

export function useWorkerAccountTabHref() {
  return useContext(WorkerAccountContext).tabHref;
}
