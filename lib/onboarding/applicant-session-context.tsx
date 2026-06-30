"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ApplicantSessionContextValue = {
  sessionReady: boolean;
  sessionLoading: boolean;
};

const ApplicantSessionContext = createContext<ApplicantSessionContextValue>({
  sessionReady: false,
  sessionLoading: true,
});

export function ApplicantSessionProvider({
  value,
  children,
}: {
  value: ApplicantSessionContextValue;
  children: ReactNode;
}) {
  return (
    <ApplicantSessionContext.Provider value={value}>{children}</ApplicantSessionContext.Provider>
  );
}

export function useApplicantSession(): ApplicantSessionContextValue {
  return useContext(ApplicantSessionContext);
}
