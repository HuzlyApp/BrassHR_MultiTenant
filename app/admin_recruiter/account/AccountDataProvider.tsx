"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAccountDataQuery } from "@/lib/account/hooks/use-account-data-query";
import type { AccountData } from "@/lib/account/types";

type AccountDataContextValue = AccountData & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AccountDataContext = createContext<AccountDataContextValue | null>(null);

export function AccountDataProvider({ children }: { children: ReactNode }) {
  const value = useAccountDataQuery();
  return <AccountDataContext.Provider value={value}>{children}</AccountDataContext.Provider>;
}

export function useAccountDataContext(): AccountDataContextValue {
  const ctx = useContext(AccountDataContext);
  if (!ctx) {
    throw new Error("useAccountData must be used within AccountDataProvider");
  }
  return ctx;
}
