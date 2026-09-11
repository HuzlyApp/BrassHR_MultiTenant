"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  absolutePublicJobShareUrl,
  copyPublicJobShareUrl,
  publicJobPlatformShareUrl,
  type PublicJobSharePlatform,
} from "@/lib/jobs/public-job-share";

const PLATFORM_LABELS: Record<PublicJobSharePlatform, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  email: "Email",
};

export function PublicJobShareControls({
  shareUrl,
  title,
  companyName,
}: {
  shareUrl: string;
  title: string;
  companyName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const resolvedUrl = useMemo(
    () => absolutePublicJobShareUrl(shareUrl, origin),
    [origin, shareUrl]
  );
  const platforms = useMemo(
    () =>
      (["linkedin", "facebook", "x", "email"] as const).map((platform) => ({
        platform,
        href: publicJobPlatformShareUrl(platform, {
          url: resolvedUrl,
          title,
          companyName,
        }),
        label: PLATFORM_LABELS[platform],
      })),
    [companyName, resolvedUrl, title]
  );

  async function copyShareLink() {
    try {
      const copiedOk = await copyPublicJobShareUrl(resolvedUrl);
      if (!copiedOk) {
        toast.error("Could not copy share link");
        return;
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy share link");
    }
  }

  if (!shareUrl) return null;

  return (
    <section className="mt-6 border-t border-slate-200 pt-5" data-testid="public-job-share">
      <h2 className="font-semibold text-slate-900">Share this job</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Copy this link to post the job on LinkedIn, Indeed, or any job board.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={resolvedUrl}
          aria-label="Public job share link"
          data-testid="public-job-share-url"
          className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
        />
        <button
          type="button"
          onClick={() => void copyShareLink()}
          data-testid="public-job-copy-share-link"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
        {platforms.map((item) => (
          <a
            key={item.platform}
            href={item.href}
            target={item.platform === "email" ? undefined : "_blank"}
            rel={item.platform === "email" ? undefined : "noopener noreferrer"}
            className="text-[color:var(--brand-primary)] hover:underline"
            data-testid={`public-job-share-${item.platform}`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}
