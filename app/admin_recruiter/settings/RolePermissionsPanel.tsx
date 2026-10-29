"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { applyGrantSelection, withRequiredView } from "@/lib/auth/permission-catalog";
import {
  useInvalidateStaffModuleAccess,
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

const ROLE_ICONS = {
  search: "/icons/roles-permissions/search.svg",
  chevron: "/icons/roles-permissions/chevron-down.svg",
  plus: "/icons/roles-permissions/plus.svg",
  crown: "/icons/roles-permissions/crown.svg",
  users: "/icons/roles-permissions/users.svg",
  userSearch: "/icons/roles-permissions/user-search.svg",
  personSupport: "/icons/roles-permissions/person-support.svg",
  receipt: "/icons/roles-permissions/receipt.svg",
  headset: "/icons/roles-permissions/headset.svg",
} as const;

type RoleIconName = keyof typeof ROLE_ICONS;

type RoleVisual = {
  typeLabel: string;
  tint: string;
  color: string;
  icon: RoleIconName;
  iconWidth: number;
  iconHeight: number;
};

const ROLE_VISUALS: RoleVisual[] = [
  { typeLabel: "Admin", tint: "rgba(66,133,244,0.15)", color: "#4285f4", icon: "crown", iconWidth: 14.5334, iconHeight: 12.6561 },
  { typeLabel: "Recruitment", tint: "rgba(244,93,72,0.15)", color: "#f45d48", icon: "users", iconWidth: 16, iconHeight: 16 },
  { typeLabel: "HR", tint: "rgba(0,181,70,0.15)", color: "#00b546", icon: "userSearch", iconWidth: 12.5334, iconHeight: 13.8667 },
  { typeLabel: "Support", tint: "rgba(255,187,0,0.15)", color: "#bc8b41", icon: "personSupport", iconWidth: 16, iconHeight: 16 },
  { typeLabel: "Finance", tint: "rgba(54,197,240,0.15)", color: "#36c5f0", icon: "receipt", iconWidth: 16, iconHeight: 16 },
  { typeLabel: "Support", tint: "rgba(124,58,237,0.15)", color: "#7c3aed", icon: "headset", iconWidth: 13.1984, iconHeight: 13.9677 },
];

const PAGE_SIZES = [6, 10, 20] as const;

function visualForRole(role: RoleRow, index: number): RoleVisual {
  const key = role.roleKey.toLowerCase();
  if (role.isAdmin || key === "admin" || key.includes("administrator")) return ROLE_VISUALS[0];
  if (key.includes("recruit")) return ROLE_VISUALS[1];
  if (key === "hr" || key.includes("human")) return ROLE_VISUALS[2];
  if (key.includes("finance") || key.includes("billing")) return ROLE_VISUALS[4];
  if (key.includes("customer") || key.includes("service")) return ROLE_VISUALS[3];
  if (key.includes("support") || key.includes("system")) return ROLE_VISUALS[5];
  return ROLE_VISUALS[index % ROLE_VISUALS.length];
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

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
    return {
      resourceKey: resource.key,
      ...withRequiredView({
        canView: existing?.canView === true,
        canEdit: existing?.canEdit === true,
        canDelete: existing?.canDelete === true,
      }),
    };
  });
}

export default function RolePermissionsPanel({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const queryClient = useQueryClient();
  const invalidateModuleAccess = useInvalidateStaffModuleAccess();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(6);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/roles");
      if (response.status === 403) {
        setHidden(true);
        return;
      }
      const body = (await response.json()) as { roles?: RoleRow[]; resources?: ResourceRow[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load roles");
      setRoles(body.roles ?? []);
      setResources(body.resources ?? []);
      setHidden(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = useMemo(
    () => grants.length > 0 && grants.every((grant) => grant.canView && grant.canEdit && grant.canDelete),
    [grants]
  );

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roles.filter((role) => {
      const matchesQuery =
        !needle ||
        role.label.toLowerCase().includes(needle) ||
        role.description.toLowerCase().includes(needle);
      return statusFilter === "inactive" ? false : matchesQuery;
    });
  }, [query, roles, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRoles = filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, pageSize]);

  function openCreate() {
    setEditing(null);
    setLabel("");
    setDescription("");
    setGrants(emptyGrants(resources));
    setOpen(true);
  }

  function openEdit(role: RoleRow) {
    setEditing(role);
    setLabel(role.label);
    setDescription(role.description);
    setGrants(grantsForRole(role, resources));
    setOpen(true);
  }

  function toggleAll(checked: boolean) {
    setGrants((current) =>
      current.map((grant) => ({ ...grant, canView: checked, canEdit: checked, canDelete: checked }))
    );
  }

  function toggle(resourceKey: string, action: Action, checked: boolean) {
    setGrants((current) =>
      current.map((grant) =>
        grant.resourceKey === resourceKey ? { ...grant, ...applyGrantSelection(grant, action, checked) } : grant
      )
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const payload = { label, description, permissions: grants };
      const response = await fetch(editing ? `/api/admin/roles/${editing.roleKey}` : "/api/admin/roles", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; access?: unknown };
      if (!response.ok) throw new Error(body.error || "Could not save role");
      toast.success(editing ? "Role updated" : "Role created");
      setOpen(false);
      if (isStaffAccessRecord(body.access)) {
        writeStaffAccessCache(queryClient, body.access);
        if (queryClient.getQueryState(staffAccessQueryKey("unknown"))) {
          queryClient.setQueryData(staffAccessQueryKey("unknown"), body.access);
        }
      } else invalidateModuleAccess();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save role");
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: RoleRow): Promise<boolean> {
    if (!canDelete || role.isSystem) return false;
    const response = await fetch(`/api/admin/roles/${role.roleKey}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      toast.error(body.error || "Could not delete role");
      return false;
    }
    toast.success("Role deleted");
    invalidateModuleAccess();
    await load();
    return true;
  }

  if (hidden) return null;

  const modules = resources.filter((resource) => resource.kind === "module");
  const settings = resources.filter((resource) => resource.kind === "settings_section");
  const userCount = editing?.userCount ?? 0;

  const headers = ["Role Name", "User Type", "Description", "Status", "Number of users", "Action"] as const;

  return (
    <section
      className="flex flex-col gap-6"
      style={{ fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif" }}
    >
      <div>
        <h1 className="text-xl font-semibold leading-7 text-black">Roles & Permissions</h1>
        <p className="text-xs font-normal leading-4 text-[#6B7280]">Manage users, roles, and access permissions.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-[30px] w-full items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 sm:w-[200px]">
          <img src={ROLE_ICONS.search} width={12} height={12} alt="" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search roles..."
            aria-label="Search roles"
            className="min-w-0 flex-1 bg-transparent text-[10px] font-normal leading-[15px] text-black outline-none placeholder:text-[#94A3B8]"
          />
        </label>
        <div className="flex items-center gap-2.5">
          <div className="relative w-[200px]">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              aria-label="All statuses"
              className="h-[30px] w-full appearance-none rounded-lg border border-[#CBD5E1] bg-white px-2.5 pr-8 text-[10px] font-normal leading-[15px] text-black outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <img
              src={ROLE_ICONS.chevron}
              width={16}
              height={16}
              alt=""
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={!canEdit || loading}
            className="flex h-[30px] shrink-0 items-center gap-1 rounded-lg bg-[#012352] px-2.5 text-[10px] font-semibold leading-[15px] text-white disabled:opacity-60"
          >
            <img src={ROLE_ICONS.plus} width={12} height={12} alt="" />
            Create Custom Role
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-[#ECF1F9] p-px">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[210px_124px_minmax(0,1fr)_100px_110px_127px] gap-px">
              {headers.map((header) => (
                <div
                  key={header}
                  className={`flex items-center px-3.5 py-2 text-[10px] font-normal leading-[15px] text-[#374151] ${
                    header === "Status" || header === "Number of users" || header === "Action"
                      ? "justify-center text-center"
                      : ""
                  }`}
                >
                  {header}
                </div>
              ))}
              {loading ? (
                <div className="col-span-6 flex h-[50px] items-center bg-white px-3.5 text-[10px] leading-[15px] text-[#6B7280]">
                  Loading roles…
                </div>
              ) : null}
              {!loading && visibleRoles.length === 0 ? (
                <div className="col-span-6 flex h-[50px] items-center bg-white px-3.5 text-[10px] leading-[15px] text-[#6B7280]">
                  No roles found
                </div>
              ) : null}
              {!loading
                ? visibleRoles.map((role, index) => {
                    const visual = visualForRole(role, (currentPage - 1) * pageSize + index);
                    return (
                      <Fragment key={role.roleKey}>
                        <div className="flex h-[50px] items-center gap-3 bg-white px-3.5">
                          <span
                            className="flex size-[30px] shrink-0 items-center justify-center rounded-lg p-1"
                            style={{ backgroundColor: visual.tint }}
                          >
                            <span className="flex size-4 items-center justify-center overflow-hidden">
                              <img
                                src={ROLE_ICONS[visual.icon]}
                                width={visual.iconWidth}
                                height={visual.iconHeight}
                                alt=""
                              />
                            </span>
                          </span>
                          <span className="truncate text-xs font-normal leading-4 text-black">{role.label}</span>
                        </div>
                        <div className="flex h-[50px] items-center bg-white px-3.5">
                          <span
                            className="rounded px-2.5 py-1 text-[10px] font-semibold leading-[15px]"
                            style={{ backgroundColor: visual.tint, color: visual.color }}
                          >
                            {visual.typeLabel}
                          </span>
                        </div>
                        <div className="flex h-[50px] items-center bg-white px-3.5">
                          <p className="line-clamp-2 text-[10px] font-normal leading-[15px] text-[#6B7280]">
                            {role.description || "—"}
                          </p>
                        </div>
                        <div className="flex h-[50px] items-center justify-center bg-white px-3.5">
                          <span className="flex w-[60px] items-center justify-center rounded bg-[rgba(18,170,0,0.15)] px-2.5 py-1 text-[10px] font-semibold leading-[15px] text-[#12AA00]">
                            Active
                          </span>
                        </div>
                        <div className="flex h-[50px] items-center justify-center bg-white px-3.5 text-[10px] font-normal leading-[15px] text-[#012352]">
                          {role.userCount}
                        </div>
                        <div className="flex h-[50px] items-center justify-center bg-white px-3">
                          <button
                            type="button"
                            onClick={() => openEdit(role)}
                            className="text-[10px] font-semibold leading-[15px] text-[#012352]"
                          >
                            Edit Permission
                          </button>
                        </div>
                      </Fragment>
                    );
                  })
                : null}
            </div>
          </div>
        </div>
        <div className="mt-px flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1 text-xs leading-4 whitespace-nowrap">
            <span className="font-normal text-[#6B7280]">Showing</span>
            <span className="font-semibold text-[#374151]">{loading ? 0 : visibleRoles.length}</span>
            <span className="font-normal text-[#6B7280]">of</span>
            <span className="font-semibold text-[#374151]">{loading ? 0 : filteredRoles.length}</span>
            <span className="font-normal text-[#6B7280]">results</span>
          </p>
          <div className="flex items-center gap-3.5">
            <label className="flex items-center gap-1.5 text-xs font-normal leading-4 text-[#374151]">
              Show
              <span className="relative">
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number])}
                  aria-label="Rows per page"
                  className="h-[28px] w-[49px] appearance-none rounded-lg border border-[#CBD5E1] bg-white py-1.5 pl-2 pr-5 text-xs leading-4 text-[#374151] outline-none"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <img
                  src={ROLE_ICONS.chevron}
                  width={16}
                  height={16}
                  alt=""
                  className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
                />
              </span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className={`rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-normal leading-4 ${
                  currentPage <= 1 ? "text-[#94A3B8]" : "text-[#374151]"
                }`}
              >
                Previous
              </button>
              {pageNumbers(currentPage, pageCount).map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-normal leading-4 ${
                    number === currentPage
                      ? "bg-[#001A46] text-white"
                      : "border border-[#CBD5E1] bg-white text-[#374151]"
                  }`}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount}
                className={`rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-normal leading-4 ${
                  currentPage >= pageCount ? "text-[#94A3B8]" : "text-[#374151]"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <form
            onSubmit={save}
            className="flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_20px_12.5px_rgba(0,0,0,0.1),0_10px_5px_rgba(0,0,0,0.04)]"
          >
            <div className="flex justify-end px-3.5 py-3">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex size-6 items-center justify-center rounded-full bg-black text-white"
              >
                <X className="size-[18px]" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-5">
              <h2 className="text-[20px] font-semibold leading-7 text-black">{editing ? "Edit Role" : "Create Role"}</h2>
              <p className="text-xs leading-4 text-[#6B7280]">
                {editing ? "Update this role and the permissions for each module." : "Create a new role and set the permissions for each module."}
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="block text-xs text-[#374151]">
                  Role Name <span className="text-[#E11D48]">*</span>
                  <input
                    required
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Enter Role Name"
                    disabled={!canEdit}
                    className="mt-2 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                  />
                </label>
                <label className="block text-xs text-[#374151]">
                  Description
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Enter a brief description (optional)"
                    disabled={!canEdit}
                    className="mt-2 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                  />
                </label>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">{label.trim() || "Role"} Permissions</p>
                  <p className="text-[10px] leading-[15px] text-[#6B7280]">
                    {userCount} {userCount === 1 ? "User" : "Users"}
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-[#012352]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={!canEdit}
                    onChange={(event) => toggleAll(event.target.checked)}
                    className="size-4 rounded border-[#012352] accent-[#012352]"
                  />
                  Select All
                </label>
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-[#E5E7EB]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Module</th>
                      {ACTIONS.map((action) => (
                        <th key={action.key} className="w-16 px-2 py-2 text-center font-medium">
                          {action.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...modules, ...settings].map((resource) => {
                      const grant = grants.find((item) => item.resourceKey === resource.key);
                      const showSettingsHeader = resource.kind === "settings_section" && settings[0]?.key === resource.key;
                      return (
                        <Fragment key={resource.key}>
                          {showSettingsHeader ? (
                            <tr className="bg-[#F8FAFC]">
                              <td colSpan={4} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Settings
                              </td>
                            </tr>
                          ) : null}
                          <tr>
                            <td className="px-3 py-2">
                              <p className="font-semibold text-[#012352]">{resource.label}</p>
                              <p className="text-[11px] text-[#6B7280]">{resource.description}</p>
                            </td>
                            {ACTIONS.map((action) => (
                              <td key={action.key} className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`${resource.label} ${action.label}`}
                                  checked={grant?.[action.key] === true}
                                  disabled={!canEdit}
                                  onChange={(event) => toggle(resource.key, action.key, event.target.checked)}
                                  className="size-4 rounded border-[#012352] accent-[#012352]"
                                />
                              </td>
                            ))}
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                {editing && !editing.isSystem ? (
                  <button
                    type="button"
                    disabled={!canDelete || saving}
                    onClick={() => {
                      if (!editing) return;
                      void remove(editing).then((deleted) => {
                        if (deleted) setOpen(false);
                      });
                    }}
                    className="h-10 rounded-lg px-4 text-sm font-medium text-[#B91C1C] disabled:opacity-40"
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-6 text-sm font-medium text-[#012352]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canEdit || saving}
                    className="h-10 rounded-lg bg-[#C6A15B] px-8 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Saving…" : editing ? "Save" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
