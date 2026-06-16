"use client";

import { createContext, useContext, type ReactNode } from "react";

type ApplicantPortalUiContextValue = {
  openRecruiterMessages: () => void;
};

const ApplicantPortalUiContext = createContext<ApplicantPortalUiContextValue | null>(null);

export function ApplicantPortalUiProvider({
  openRecruiterMessages,
  children,
}: {
  openRecruiterMessages: () => void;
  children: ReactNode;
}) {
  return (
    <ApplicantPortalUiContext.Provider value={{ openRecruiterMessages }}>
      {children}
    </ApplicantPortalUiContext.Provider>
  );
}

export function useApplicantPortalUi() {
  const context = useContext(ApplicantPortalUiContext);
  if (!context) {
    throw new Error("useApplicantPortalUi must be used within ApplicantPortalUiProvider");
  }
  return context;
}
