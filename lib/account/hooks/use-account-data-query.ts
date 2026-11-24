"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

export function useAccountDataQuery() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  const query = useQuery({
    queryKey: [...ACCOUNT_DATA_QUERY_KEY, userId ?? "signed-out"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const data = await fetchAccountData(supabaseBrowser);
      if (data.user?.id !== userId) throw new Error("The signed-in account changed. Please reload.");
      return data;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_DATA_QUERY_KEY });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    ...EMPTY,
    ...(userId ? query.data ?? EMPTY : EMPTY),
    loading: userId === undefined || (Boolean(userId) && query.isLoading),
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
