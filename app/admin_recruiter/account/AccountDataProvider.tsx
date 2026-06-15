"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchAccountData } from "@/lib/account/fetch-account-data";
import type { AccountData } from "@/lib/account/types";
import { supabaseBrowser } from "@/lib/supabase-browser";

type AccountDataContextValue = AccountData & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AccountDataContext = createContext<AccountDataContextValue | null>(null);

export function AccountDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccountData>({
    user: null,
    profile: null,
    organization: null,
    settings: null,
    checklist: null,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAccountData(supabaseBrowser);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo<AccountDataContextValue>(
    () => ({
      ...data,
      loading,
      error,
      refresh,
    }),
    [data, loading, error, refresh]
  );

  return <AccountDataContext.Provider value={value}>{children}</AccountDataContext.Provider>;
}

export function useAccountDataContext(): AccountDataContextValue {
  const ctx = useContext(AccountDataContext);
  if (!ctx) {
    throw new Error("useAccountData must be used within AccountDataProvider");
  }
  return ctx;
}
