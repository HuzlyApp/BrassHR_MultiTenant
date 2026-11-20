"use client";

import { useEffect, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

export function DomainStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: (workspaceUrl: string) => void;
}) {
  const { organization, refresh } = useAccountData();
  const [subdomain, setSubdomain] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rootDomain, setRootDomain] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization?.subdomain) setSubdomain(organization.subdomain);
  }, [organization?.subdomain]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setStatus(null);
    void (async () => {
      try {
        const response = await fetch("/api/admin/launch-pad/domain", { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { rootDomain?: string; error?: string; detail?: string };
        if (!response.ok || !data.rootDomain) throw new Error(data.detail ?? data.error ?? "Could not load your domain settings.");
        setRootDomain(data.rootDomain);
      } catch (cause) {
        if (!controller.signal.aborted) setStatus(cause instanceof Error ? cause.message : "Could not load your domain settings.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [loadAttempt]);

  const handleContinue = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/launch-pad/domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain }),
      });
      const data = await response.json() as { error?: string; detail?: string; workspaceUrl?: string };
      if (!response.ok) throw new Error(data.detail ?? data.error ?? "Could not save your domain.");
      if (!data.workspaceUrl) throw new Error("Your domain was saved, but its workspace address is unavailable. Please try again.");
      await refresh();
      onComplete(data.workspaceUrl);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save your domain.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[620px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              Setup Custom Domain
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              Choose the address for your company workspace and applicant portal.
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] p-[30px]">
            <div className="flex items-center gap-0">
              <input
                aria-label="Company subdomain"
                value={subdomain}
                onChange={(e) =>
                  setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="yourname"
                className="h-9 min-w-0 flex-1 rounded-l-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352]"
                style={interStyle}
              />
              <span
                className="inline-flex h-9 items-center rounded-r-lg border border-l-0 border-[#E5E7EB] bg-[#F9FAFB] px-3 text-[12px] text-[#6B7280]"
                style={interStyle}
              >
                {rootDomain ? `.${rootDomain}` : loading ? "Loading domain…" : "Domain unavailable"}
              </span>
            </div>
            {status ? (
              <p
                role="alert"
                className={`mt-2 text-[12px] ${status === "Available" ? "text-[#16A34A]" : "text-[#DC2626]"}`}
                style={interStyle}
              >
                {status}
              </p>
            ) : null}
            {!rootDomain && !loading ? (
              <button type="button" className="mt-3 text-sm font-semibold text-[#012352] underline" onClick={() => setLoadAttempt((value) => value + 1)}>Retry domain settings</button>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[#E5E7EB]">
          <LaunchPadStepActions
            onSkip={onSkip}
            onBack={onBack}
            onContinue={() => void handleContinue()}
            saving={saving}
            continueDisabled={!subdomain.trim() || !rootDomain}
          />
        </div>
      </div>
    </div>
  );
}
