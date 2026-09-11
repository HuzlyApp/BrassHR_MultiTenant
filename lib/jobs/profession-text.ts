export function professionCodeFromName(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "CUSTOM";
}

export function matchProfessionIdByName(
  professions: Array<{ id: string; name: string }>,
  name: string
): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return professions.find((item) => item.name.trim().toLowerCase() === needle)?.id ?? null;
}

export function professionInputValue(
  job: { profession?: string | null; professionId?: string | null },
  professions: Array<{ id: string; name: string }>
): string {
  if (typeof job.profession === "string") return job.profession;
  const id = job.professionId?.trim();
  if (!id) return "";
  return professions.find((item) => item.id === id)?.name ?? "";
}

export function embeddedRelationName(value: unknown): string {
  if (!value) return "";
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return "";
  const name = (row as { name?: unknown }).name;
  return typeof name === "string" ? name.trim() : "";
}
