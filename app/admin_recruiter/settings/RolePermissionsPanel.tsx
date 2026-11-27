"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

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

const ROLE_ICONS = {
  search: "/icons/roles-permissions/search.svg",
  chevron: "/icons/roles-permissions/chevron-down.svg",
  plus: "/icons/roles-permissions/plus.svg",
  crown: "/icons/roles-permissions/crown.svg",
  users: "/icons/roles-permissions/users.svg",
  person: "/icons/roles-permissions/person.svg",
  headset: "/icons/roles-permissions/headset.svg",
  building: "/icons/roles-permissions/building.svg",
  gear: "/icons/roles-permissions/gear.svg",
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
  { typeLabel: "Admin", tint: "rgba(66,133,244,0.15)", color: "#4285f4", icon: "crown", iconWidth: 14.5, iconHeight: 12.7 },
  { typeLabel: "Recruitment", tint: "rgba(244,93,72,0.15)", color: "#f45d48", icon: "users", iconWidth: 16, iconHeight: 16 },
  { typeLabel: "HR", tint: "rgba(0,181,70,0.15)", color: "#00b546", icon: "person", iconWidth: 14, iconHeight: 14 },
  { typeLabel: "Support", tint: "rgba(255,187,0,0.15)", color: "#bc8b41", icon: "headset", iconWidth: 14, iconHeight: 14 },
  { typeLabel: "Finance", tint: "rgba(54,197,240,0.15)", color: "#36c5f0", icon: "building", iconWidth: 14, iconHeight: 14 },
  { typeLabel: "Custom", tint: "rgba(100,116,139,0.15)", color: "#64748b", icon: "gear", iconWidth: 14, iconHeight: 14 },
];

const PAGE_SIZES = [6, 10, 20] as const;

/** Exported for unit tests — User Type must not label non-admin custom roles as Admin. */
export function visualForRole(role: RoleRow, _index = 0): RoleVisual {
  const key = role.roleKey.toLowerCase();
  const label = role.label.toLowerCase();
  if (role.isAdmin || key === "admin" || key.includes("administrator") || label.includes("administrator")) {
    return ROLE_VISUALS[0];
  }
  if (key.includes("recruit") || label.includes("recruiter") || label.includes("hiring")) {
    return ROLE_VISUALS[1];
  }
  if (key === "hr" || key.includes("human") || label.includes("human resource")) return ROLE_VISUALS[2];
  if (key.includes("finance") || key.includes("billing") || label.includes("finance")) return ROLE_VISUALS[4];
  if (key.includes("customer") || label.includes("customer service")) return ROLE_VISUALS[3];
  if (key.includes("system") || label.includes("system support") || key.includes("support")) {
    return ROLE_VISUALS[3];
  }

  // Infer from grants so Hiring-only custom roles show Recruitment, not Admin.
  const enabled = (role.permissions ?? []).filter(
    (grant) => grant.canView || grant.canEdit || grant.canDelete
  );
  const onlyHiring =
    enabled.length > 0 &&
    enabled.every((grant) => {
      const resource = grant.resourceKey.toLowerCase();
      return resource === "hiring" || resource.startsWith("hiring_") || resource.includes("recruit");
    });
  if (onlyHiring) return ROLE_VISUALS[1];

  // Never cycle into Admin for non-admin roles.
  return ROLE_VISUALS[5];
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export default function RolePermissionsPanel({ canEdit }: { canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [query, setQuery] = useState("");
  const [roleTypeFilter, setRoleTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/roles");
      if (response.status === 403) {
        setHidden(true);
        return;
      }
      const body = (await response.json()) as { roles?: RoleRow[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load roles");
      setRoles(body.roles ?? []);
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

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roles.filter((role, index) => {
      const matchesQuery =
        !needle ||
        role.label.toLowerCase().includes(needle) ||
        role.description.toLowerCase().includes(needle);
      const matchesType =
        roleTypeFilter === "all" || visualForRole(role, index).typeLabel === roleTypeFilter;
      const matchesStatus = statusFilter !== "inactive";
      return matchesQuery && matchesType && matchesStatus;
    });
  }, [query, roleTypeFilter, roles, statusFilter]);

  const roleTypeOptions = useMemo(
    () => Array.from(new Set(ROLE_VISUALS.map((visual) => visual.typeLabel))),
    []
  );

  const pageCount = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRoles = filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, roleTypeFilter, statusFilter, pageSize]);

  if (hidden) return null;

  const headers = ["Role Name", "User Type", "Description", "Status", "Number of users", "Action"] as const;

  return (
    <section
      className="flex flex-col gap-6"
      style={{ fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif" }}
    >
      <div className="flex sm:justify-end">
        <button
          type="button"
          onClick={() => router.push("/admin_recruiter/settings/roles/new")}
          disabled={!canEdit || loading}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#012352] px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto sm:shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ROLE_ICONS.plus} width={14} height={14} alt="" />
          Create Custom Role
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 sm:max-w-[320px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ROLE_ICONS.search} width={14} height={14} alt="" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search roles..."
            aria-label="Search roles"
            className="min-w-0 flex-1 bg-transparent text-sm font-normal text-black outline-none placeholder:text-[#94A3B8]"
          />
        </label>
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 w-full sm:w-[160px]">
            <select
              value={roleTypeFilter}
              onChange={(event) => setRoleTypeFilter(event.target.value)}
              aria-label="All Roles"
              className="h-10 w-full appearance-none rounded-lg border border-[#CBD5E1] bg-white px-3 pr-8 text-sm font-normal text-black outline-none"
            >
              <option value="all">All Roles</option>
              {roleTypeOptions.map((typeLabel) => (
                <option key={typeLabel} value={typeLabel}>
                  {typeLabel}
                </option>
              ))}
            </select>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ROLE_ICONS.chevron}
              width={16}
              height={16}
              alt=""
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            />
          </div>
          <div className="relative min-w-0 w-full sm:w-[160px]">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              aria-label="All statuses"
              className="h-10 w-full appearance-none rounded-lg border border-[#CBD5E1] bg-white px-3 pr-8 text-sm font-normal text-black outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ROLE_ICONS.chevron}
              width={16}
              height={16}
              alt=""
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            />
          </div>
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
                              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            onClick={() =>
                              router.push(
                                `/admin_recruiter/settings/roles/${encodeURIComponent(role.roleKey)}`
                              )
                            }
                            className="text-[10px] font-semibold leading-[15px] text-[#012352]"
                          >
                            View Details
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
    </section>
  );
}
