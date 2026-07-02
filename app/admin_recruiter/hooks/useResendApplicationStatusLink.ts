"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import { supabaseBrowser } from "@/lib/supabase-browser";

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useResendApplicationStatusLink(workerId: string | null | undefined) {
  const [resending, setResending] = useState(false);

  const resend = useCallback(async () => {
    const id = workerId?.trim();
    if (!id) return;

    setResending(true);
    try {
      const res = await fetch("/api/admin/workers/send-notification-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          workerId: id,
          templateKey: EMAIL_TEMPLATE_TYPE.APPLICATION_STATUS,
          clientOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        skipped?: boolean;
        error?: string;
      };

      if (!res.ok) {
        toast.error(json.error || "Could not send status link email.");
        return;
      }

      if (json.skipped) {
        toast.success("Status link email was already sent recently.");
        return;
      }

      toast.success("Application status link sent.");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setResending(false);
    }
  }, [workerId]);

  return { resend, resending };
}
