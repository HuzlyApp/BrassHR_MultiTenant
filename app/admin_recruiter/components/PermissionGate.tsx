"use client";

import type { ReactNode } from "react";
import type { PermissionAction } from "@/lib/auth/permission-catalog";
import {
  useModulePermission,
  usePathModulePermission,
} from "@/lib/admin/hooks/use-staff-module-access";

type GateProps = {
  /** Catalog resource key (`hiring`, `jobs`, `settings_company`, …). Omit to resolve from the current path. */
  resourceKey?: string;
  action: PermissionAction;
  children: ReactNode;
  /** Optional fallback while grants are loading (default: hide). */
  fallback?: ReactNode;
};

/**
 * Renders children only when `/api/admin/access` grants the action for the resource.
 * Admin role changes apply on the next access refetch — no role names are hard-coded here.
 */
export function PermissionGate({ resourceKey, action, children, fallback = null }: GateProps) {
  const byKey = useModulePermission(resourceKey ?? "");
  const byPath = usePathModulePermission();
  const access = resourceKey ? byKey : byPath;

  if (access.loading) return <>{fallback}</>;
  const allowed =
    action === "view" ? access.canView : action === "edit" ? access.canEdit : access.canDelete;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

export function IfCanView(props: Omit<GateProps, "action">) {
  return <PermissionGate {...props} action="view" />;
}

export function IfCanEdit(props: Omit<GateProps, "action">) {
  return <PermissionGate {...props} action="edit" />;
}

export function IfCanDelete(props: Omit<GateProps, "action">) {
  return <PermissionGate {...props} action="delete" />;
}
