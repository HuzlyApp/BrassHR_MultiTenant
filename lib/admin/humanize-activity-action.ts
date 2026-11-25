/**
 * Turn audit/activity action keys (e.g. worker.profile.view) into readable labels.
 */
export function collapseRepeatedProfileViews<T extends { action: string | null; created_at: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (humanizeActivityAction(row.action) !== "Viewed profile" || !row.created_at) return true;
    const minute = row.created_at.slice(0, 16);
    if (seen.has(minute)) return false;
    seen.add(minute);
    return true;
  });
}

export function humanizeActivityAction(action: string | null | undefined): string {
  const raw = String(action ?? "").trim();
  if (!raw) return "Activity";

  // Already human-readable prose.
  if (/\s/.test(raw) && !raw.includes(".")) return raw;

  const key = raw.replace(/^activity[._]/i, "").replace(/[_]+/g, ".");
  const known: Record<string, string> = {
    "worker.profile.view": "Viewed profile",
    "worker.profile.self_view": "Viewed own profile",
    "worker.profile.field_update": "Updated profile field",
    "worker.profile.reference_update": "Updated references",
    "worker.profile.pay_rate_update": "Updated pay rate",
    "worker.profile.license_type_update": "Updated license type",
    "worker.profile.license_expires_update": "Updated license expiration",
    "worker.checklist.view": "Viewed checklist",
    "worker.checklist.update": "Updated checklist",
    "worker.resume.view": "Viewed resume",
    "worker.resume.upload": "Uploaded resume",
    "worker.attachments.view": "Viewed attachments",
    "worker.pre_hire.view": "Viewed pre-hire",
    "worker.post_hire.view": "Viewed post-hire",
    "worker.hire_journey.view": "Viewed hire journey",
    "worker.ai_analysis.view": "Viewed AI analysis",
    "worker.status.change": "Changed status",
    "job.application.view": "Viewed application",
    "job.application.status_change": "Changed application status",
  };
  if (known[key]) return known[key];
  if (known[raw]) return known[raw];

  const parts = key.split(".").filter(Boolean);
  if (parts.length === 0) return raw;
  const last = parts[parts.length - 1] ?? raw;
  const verbMap: Record<string, string> = {
    view: "Viewed",
    self_view: "Viewed",
    update: "Updated",
    field_update: "Updated",
    create: "Created",
    delete: "Deleted",
    upload: "Uploaded",
    download: "Downloaded",
    change: "Changed",
  };
  const verb = verbMap[last] ?? null;
  const subject = parts
    .slice(0, -1)
    .join(" ")
    .replace(/\bworker\b/gi, "candidate")
    .replace(/\bprofile\b/gi, "profile")
    .replace(/[_-]+/g, " ")
    .trim();

  if (verb && subject) {
    return `${verb} ${subject}`.replace(/\s+/g, " ").trim();
  }

  return raw
    .replace(/[._]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}
