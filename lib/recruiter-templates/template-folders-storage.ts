/**
 * Lightweight client-side folder grouping for recruiter templates.
 * No backend folder API exists yet — persist per-tenant in localStorage.
 */

export type RecruiterTemplateFolder = {
  id: string;
  name: string;
  templateIds: string[];
  createdAt: string;
};

export type FolderStatusCounts = {
  active: number;
  draft: number;
  archived: number;
};

const STORAGE_PREFIX = "brasshr.recruiterTemplateFolders.v1:";

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope || "default"}`;
}

function safeParse(raw: string | null): RecruiterTemplateFolder[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecruiterTemplateFolder => {
        if (!item || typeof item !== "object") return false;
        const row = item as Partial<RecruiterTemplateFolder>;
        return (
          typeof row.id === "string" &&
          typeof row.name === "string" &&
          Array.isArray(row.templateIds) &&
          typeof row.createdAt === "string"
        );
      })
      .map((row) => ({
        id: row.id,
        name: row.name,
        templateIds: row.templateIds.filter((id): id is string => typeof id === "string"),
        createdAt: row.createdAt,
      }));
  } catch {
    return [];
  }
}

export function resolveFolderStorageScope(tenantId?: string | null, slug?: string | null): string {
  const id = tenantId?.trim();
  if (id) return id;
  const s = slug?.trim();
  if (s) return s;
  return "default";
}

export function readTemplateFolders(scope: string): RecruiterTemplateFolder[] {
  if (typeof window === "undefined") return [];
  try {
    return safeParse(window.localStorage.getItem(storageKey(scope)));
  } catch {
    return [];
  }
}

export function writeTemplateFolders(scope: string, folders: RecruiterTemplateFolder[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(folders));
  } catch {
    // Quota / private mode — ignore; UI still works for the session.
  }
}

export function createTemplateFolder(
  scope: string,
  name: string,
  templateIds: string[] = []
): RecruiterTemplateFolder {
  const folder: RecruiterTemplateFolder = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `folder_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: name.trim(),
    templateIds: [...new Set(templateIds.filter(Boolean))],
    createdAt: new Date().toISOString(),
  };
  const next = [...readTemplateFolders(scope), folder];
  writeTemplateFolders(scope, next);
  return folder;
}

export function updateTemplateFolder(
  scope: string,
  folderId: string,
  patch: Partial<Pick<RecruiterTemplateFolder, "name" | "templateIds">>
): RecruiterTemplateFolder | null {
  const folders = readTemplateFolders(scope);
  const index = folders.findIndex((f) => f.id === folderId);
  if (index < 0) return null;
  const current = folders[index];
  const updated: RecruiterTemplateFolder = {
    ...current,
    name: patch.name?.trim() ? patch.name.trim() : current.name,
    templateIds:
      patch.templateIds != null
        ? [...new Set(patch.templateIds.filter(Boolean))]
        : current.templateIds,
  };
  const next = [...folders];
  next[index] = updated;
  writeTemplateFolders(scope, next);
  return updated;
}

export function deleteTemplateFolder(scope: string, folderId: string): boolean {
  const folders = readTemplateFolders(scope);
  const next = folders.filter((f) => f.id !== folderId);
  if (next.length === folders.length) return false;
  writeTemplateFolders(scope, next);
  return true;
}

export function assignTemplateToFolder(
  scope: string,
  templateId: string,
  folderId: string | null
): void {
  const folders = readTemplateFolders(scope).map((folder) => ({
    ...folder,
    templateIds: folder.templateIds.filter((id) => id !== templateId),
  }));
  if (folderId) {
    const target = folders.find((f) => f.id === folderId);
    if (target) target.templateIds = [...target.templateIds, templateId];
  }
  writeTemplateFolders(scope, folders);
}

export function findFolderForTemplate(
  folders: RecruiterTemplateFolder[],
  templateId: string
): RecruiterTemplateFolder | null {
  return folders.find((f) => f.templateIds.includes(templateId)) ?? null;
}

export function getAssignedTemplateIds(folders: RecruiterTemplateFolder[]): Set<string> {
  const ids = new Set<string>();
  for (const folder of folders) {
    for (const id of folder.templateIds) ids.add(id);
  }
  return ids;
}

export function countFolderStatuses(
  folder: RecruiterTemplateFolder,
  templates: Array<{ id: string; status: string }>
): FolderStatusCounts {
  const idSet = new Set(folder.templateIds);
  const counts: FolderStatusCounts = { active: 0, draft: 0, archived: 0 };
  for (const template of templates) {
    if (!idSet.has(template.id)) continue;
    if (template.status === "active") counts.active += 1;
    else if (template.status === "archived") counts.archived += 1;
    else counts.draft += 1;
  }
  return counts;
}

export function formatFolderStatusLine(counts: FolderStatusCounts): string {
  return `${counts.active} Active • ${counts.draft} Draft • ${counts.archived} Archived`;
}

export function folderPrimaryBadge(counts: FolderStatusCounts): "Active" | "Draft" | "Archived" {
  if (counts.active > 0) return "Active";
  if (counts.draft > 0) return "Draft";
  if (counts.archived > 0) return "Archived";
  return "Draft";
}
