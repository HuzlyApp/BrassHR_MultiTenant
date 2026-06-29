"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchAccountData } from "@/lib/account/fetch-account-data";
import type { AccountData } from "@/lib/account/types";
import { supabaseBrowser } from "@/lib/supabase-browser";

export const ACCOUNT_DATA_QUERY_KEY = ["account-data"] as const;

const EMPTY: AccountData = {
  user: null,
  profile: null,
  organization: null,
  settings: null,
  checklist: null,
};

async function loadAccountData(): Promise<AccountData> {
  return fetchAccountData(supabaseBrowser);
}

export function useAccountDataQuery() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ACCOUNT_DATA_QUERY_KEY,
    queryFn: loadAccountData,
    staleTime: 60_000,
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_DATA_QUERY_KEY });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    ...EMPTY,
    ...(query.data ?? EMPTY),
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
