type ApplicationStatusRow = {
  id?: string;
  systemKey?: string | null;
};

/** Archives job applications by id using the tenant's archived status. */
export async function bulkArchiveApplications(
  applicationIds: string[],
  note = "Archived from candidates list"
): Promise<{ archived: number; failed: number }> {
  const uniqueIds = [...new Set(applicationIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { archived: 0, failed: 0 };

  const statusRes = await fetch("/api/admin/application-statuses?activeOnly=1", {
    cache: "no-store",
  });
  const statusPayload = await statusRes.json().catch(() => ({}));
  if (!statusRes.ok) {
    throw new Error(
      typeof statusPayload.error === "string"
        ? statusPayload.error
        : "Failed to load application statuses"
    );
  }

  const statuses = Array.isArray(statusPayload.statuses)
    ? (statusPayload.statuses as ApplicationStatusRow[])
    : [];
  const archivedStatus = statuses.find((status) => status.systemKey === "archived");
  if (!archivedStatus?.id) {
    throw new Error("Archived status is not configured for this organization.");
  }

  let archived = 0;
  let failed = 0;
  for (const applicationId of uniqueIds) {
    const response = await fetch(
      `/api/admin/job-applications/${encodeURIComponent(applicationId)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statusId: archivedStatus.id,
          note,
        }),
      }
    );
    if (response.ok) archived += 1;
    else failed += 1;
  }

  return { archived, failed };
}
