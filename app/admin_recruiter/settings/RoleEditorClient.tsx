"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import toast from "react-hot-toast";
import SuccessModal from "@/app/components/SuccessModal";
import {
  applyGrantSelection,
  seededGrantForRole,
  withRequiredView,
} from "@/lib/auth/permission-catalog";
import {
  useInvalidateStaffModuleAccess,
  useModulePermission,
  writeStaffAccessCache,
} from "@/lib/admin/hooks/use-staff-module-access";
import { isStaffAccessRecord, staffAccessQueryKey } from "@/lib/admin/staff-access-cache";

type ResourceRow = {
  key: string;
  label: string;
  description: string;
  kind: "module" | "settings_section";
};

type Grant = { resourceKey: string; canView: boolean; canEdit: boolean; canDelete: boolean };

type RoleRow = {
  roleKey: string;
  label: string;
  description: string;
  isSystem: boolean;
  isAdmin: boolean;
  userCount: number;
  permissions: Grant[];
};

type Action = "canView" | "canEdit" | "canDelete";

const ACTIONS: { key: Action; label: string }[] = [
  { key: "canView", label: "View" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
];

const ROLES_LIST_HREF = "/admin_recruiter/settings/roles";

function emptyGrants(resources: ResourceRow[]): Grant[] {
  return resources.map((resource) => ({
    resourceKey: resource.key,
    canView: false,
    canEdit: false,
    canDelete: false,
  }));
}

function grantsForRole(role: RoleRow, resources: ResourceRow[]): Grant[] {
  return resources.map((resource) => {
    const existing = role.permissions.find((permission) => permission.resourceKey === resource.key);
    if (existing) {
      return {
        resourceKey: resource.key,
        ...withRequiredView({
          canView: existing.canView === true,
          canEdit: existing.canEdit === true,
          canDelete: existing.canDelete === true,
        }),
      };
    }
    const seeded = seededGrantForRole(role.isAdmin, resource.key);
    return {
      resourceKey: resource.key,
      ...withRequiredView({
        canView: seeded?.canView === true,
        canEdit: seeded?.canEdit === true,
        canDelete: seeded?.canDelete === true,
      }),
    };
  });
}

function isModuleEnabled(grant: Grant | undefined): boolean {
  return Boolean(grant?.canView || grant?.canEdit || grant?.canDelete);
}

export default function RoleEditorClient({
  mode,
  roleKey,
}: {
  mode: "create" | "edit";
  roleKey?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateModuleAccess = useInvalidateStaffModuleAccess();
  const { canEdit, canDelete, canView, loading: permissionLoading } = useModulePermission("settings_company");

  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [label, setLabel] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [successOpen, setSuccessOpen] = useState(false);
  const [savedRoleKey, setSavedRoleKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/roles");
      if (response.status === 403) {
        toast.error("You do not have permission to manage roles");
        router.replace(ROLES_LIST_HREF);
        return;
      }
      const body = (await response.json()) as {
        roles?: RoleRow[];
        resources?: ResourceRow[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Could not load roles");
      const nextResources = body.resources ?? [];
      setResources(nextResources);

      if (mode === "edit" && roleKey) {
        const role = (body.roles ?? []).find((row) => row.roleKey === roleKey) ?? null;
        if (!role) {
          toast.error("Role not found");
          router.replace(ROLES_LIST_HREF);
          return;
        }
        setEditing(role);
        setLabel(role.label);
        setDescription(role.description);
        setGrants(grantsForRole(role, nextResources));
      } else {
        setEditing(null);
        setLabel("");
        setDescription("");
        setGrants(emptyGrants(nextResources));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load roles");
    } finally {
      setLoading(false);
    }
  }, [mode, roleKey, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredResources = useMemo(() => {
    const needle = moduleQuery.trim().toLowerCase();
    return resources.filter((resource) => {
      const grant = grants.find((item) => item.resourceKey === resource.key);
      const enabled = isModuleEnabled(grant);
      const matchesQuery =
        !needle ||
        resource.label.toLowerCase().includes(needle) ||
        resource.description.toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && enabled) ||
        (statusFilter === "inactive" && !enabled);
      return matchesQuery && matchesStatus;
    });
  }, [grants, moduleQuery, resources, statusFilter]);

  function toggle(resourceKey: string, action: Action, checked: boolean) {
    setGrants((current) =>
      current.map((grant) =>
        grant.resourceKey === resourceKey ? { ...grant, ...applyGrantSelection(grant, action, checked) } : grant
      )
    );
  }

  function setModuleEnabled(resourceKey: string, enabled: boolean) {
    setGrants((current) =>
      current.map((grant) =>
        grant.resourceKey === resourceKey
          ? {
              ...grant,
              ...withRequiredView({
                canView: enabled,
                canEdit: false,
                canDelete: false,
              }),
            }
          : grant
      )
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    const trimmed = label.trim();
    if (!trimmed || trimmed.length > 80) {
      setNameError(!trimmed ? "Role name is required." : "Role name must be 80 characters or fewer.");
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const editableKeys = new Set(resources.map((resource) => resource.key));
      const payload = {
        label: trimmed,
        description: description.trim(),
        permissions: grants.filter((grant) => editableKeys.has(grant.resourceKey)),
      };
      const response = await fetch(
        mode === "edit" && editing ? `/api/admin/roles/${editing.roleKey}` : "/api/admin/roles",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        access?: unknown;
        roleKey?: string;
      };
      if (!response.ok) throw new Error(body.error || "Could not save role");
      if (isStaffAccessRecord(body.access)) {
        writeStaffAccessCache(queryClient, body.access);
        if (queryClient.getQueryState(staffAccessQueryKey("unknown"))) {
          queryClient.setQueryData(staffAccessQueryKey("unknown"), body.access);
        }
      } else {
        invalidateModuleAccess();
      }
      const savedKey = (editing?.roleKey ?? body.roleKey ?? "").trim();
      setSavedRoleKey(savedKey);
      setSuccessOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save role");
    } finally {
      setSaving(false);
    }
  }

  function handleSuccessClose() {
    setSuccessOpen(false);
    router.push(ROLES_LIST_HREF);
  }

  async function removeRole() {
    if (!editing || editing.isSystem || !canDelete) return;
    if (!window.confirm(`Delete role “${editing.label}”?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${editing.roleKey}`, { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not delete role");
      toast.success("Role deleted");
      invalidateModuleAccess();
      router.push(ROLES_LIST_HREF);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete role");
    } finally {
      setSaving(false);
    }
  }

  if (!permissionLoading && !canView) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 sm:px-6">
        <p className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
          You do not have permission to manage roles.
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={save} className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      <div>
        <Link
          href={ROLES_LIST_HREF}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
        <h1 className="mt-3 text-lg font-semibold leading-6 tracking-tight text-[#0F172A]">
          {mode === "edit"
            ? loading && !editing
              ? "Edit Role"
              : editing?.isSystem
                ? "Edit Built-in Role"
                : "Edit Custom Role"
            : "Create Custom Role"}
        </h1>
        <p className="mt-1 text-sm leading-5 text-[#64748B]">
          {mode === "edit"
            ? editing?.isSystem ? "Update permissions for this built-in role." : "Update this custom role and set the permissions for each module."
            : "Create a new custom role and set the permissions for each module."}
        </p>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-900/[0.02] sm:p-6">
        <label className="block text-sm font-medium text-[#374151]">
          Role Name <span className="text-[#E11D48]">*</span>
          <input
            required
            value={label}
            maxLength={80}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "role-name-error role-name-limit" : "role-name-limit"}
            onChange={(event) => { setLabel(event.target.value); setNameError(null); }}
            placeholder="Marketing Manager"
            disabled={!canEdit || loading}
            className="mt-2 h-11 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#0F172A] outline-none focus:border-[#012352] focus:ring-1 focus:ring-[#012352]/20 disabled:bg-[#F8FAFC]"
          />
        </label>
        <p id="role-name-limit" className="mt-1 text-xs text-[#64748B]">{label.length}/80 characters</p>
        {nameError ? <p id="role-name-error" role="alert" className="mt-1 text-sm text-[#B91C1C]">{nameError}</p> : null}
        <label className="mt-4 block text-sm font-medium text-[#374151]">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Describe this role and its responsibilities."
            disabled={!canEdit || loading}
            className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#012352] focus:ring-1 focus:ring-[#012352]/20 disabled:bg-[#F8FAFC]"
          />
        </label>

        <div className="mt-8">
          <h2 className="text-base font-semibold text-[#0F172A]">Permissions</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 sm:max-w-[320px]">
              <Search className="h-4 w-4 text-[#94A3B8]" aria-hidden />
              <input
                value={moduleQuery}
                onChange={(event) => setModuleQuery(event.target.value)}
                placeholder="Search modules..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#94A3B8]"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none"
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-4 divide-y divide-[#F1F5F9] overflow-hidden rounded-xl border border-[#E5E7EB]">
            {loading ? (
              <p className="px-4 py-8 text-sm text-[#64748B]">Loading permissions…</p>
            ) : filteredResources.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[#64748B]">No modules found.</p>
            ) : (
              filteredResources.map((resource) => {
                const grant = grants.find((item) => item.resourceKey === resource.key);
                const enabled = isModuleEnabled(grant);
                const alwaysOn = resource.key === "dashboard";
                return (
                  <div
                    key={resource.key}
                    className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                      !enabled && !alwaysOn ? "bg-[#F8FAFC] opacity-80" : "bg-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0F172A]">{resource.label}</p>
                      <p className="mt-0.5 text-xs text-[#64748B]">{resource.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      {ACTIONS.map((action) => (
                        <label
                          key={action.key}
                          className="inline-flex items-center gap-2 text-sm text-[#0F172A]"
                        >
                          <input
                            type="checkbox"
                            checked={grant?.[action.key] === true}
                            disabled={!canEdit || alwaysOn || (!enabled && action.key !== "canView")}
                            onChange={(event) => toggle(resource.key, action.key, event.target.checked)}
                            className="h-4 w-4 rounded border-[#CBD5E1] text-[#012352] accent-[#012352]"
                          />
                          {action.label}
                        </label>
                      ))}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled || alwaysOn}
                        aria-label={`Enable ${resource.label}`}
                        disabled={!canEdit || alwaysOn}
                        onClick={() => setModuleEnabled(resource.key, !(enabled || alwaysOn))}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                          enabled || alwaysOn ? "bg-[#012352]" : "bg-[#CBD5E1]"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                            enabled || alwaysOn ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <span className="text-xs font-medium text-[#64748B]">Enable</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E7EB] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {mode === "edit" && editing && !editing.isSystem ? (
            <button
              type="button"
              disabled={!canDelete || saving}
              onClick={() => void removeRole()}
              className="h-10 rounded-lg px-4 text-sm font-medium text-[#B91C1C] disabled:opacity-40"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <Link
              href={ROLES_LIST_HREF}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-5 text-sm font-medium text-[#012352]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canEdit || saving || loading}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#012352] px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <SuccessModal
        open={successOpen}
        onClose={handleSuccessClose}
        title="Success!"
        message={mode === "edit" ? "Role updated successfully." : "New Role Added"}
        actionLabel="View"
        onAction={() => {
          setSuccessOpen(false);
          router.push(
            savedRoleKey
              ? `/admin_recruiter/settings/roles/${encodeURIComponent(savedRoleKey)}`
              : ROLES_LIST_HREF
          );
        }}
      />
    </form>
  );
}
