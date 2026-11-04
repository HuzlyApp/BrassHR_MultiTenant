import { withRequiredView, type StoredGrant } from "@/lib/auth/permission-catalog";

type PermissionBody = {
  resourceKey?: unknown;
  canView?: unknown;
  canEdit?: unknown;
  canDelete?: unknown;
};

/**
 * Normalize a role-permission payload against the editable resource set.
 * Always-granted / unknown / duplicate keys are ignored (not rejected) so a
 * stale editor matrix cannot 400 after catalog migrations.
 */
export function parseRolePermissionGrants(
  value: unknown,
  allowed: Set<string>,
  fillMissing: (resourceKey: string) => StoredGrant
): Array<{ resourceKey: string } & StoredGrant> | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const grants: Array<{ resourceKey: string } & StoredGrant> = [];

  for (const item of value as PermissionBody[]) {
    const resourceKey = typeof item?.resourceKey === "string" ? item.resourceKey.trim() : "";
    if (!resourceKey || !allowed.has(resourceKey) || seen.has(resourceKey)) continue;
    seen.add(resourceKey);
    grants.push({
      resourceKey,
      ...withRequiredView({
        canView: item.canView === true,
        canEdit: item.canEdit === true,
        canDelete: item.canDelete === true,
      }),
    });
  }

  for (const key of allowed) {
    if (seen.has(key)) continue;
    grants.push({ resourceKey: key, ...fillMissing(key) });
  }

  return grants;
}
