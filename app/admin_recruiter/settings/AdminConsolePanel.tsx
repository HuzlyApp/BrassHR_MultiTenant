"use client";

import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, Mail, MoreHorizontal, UserCheck, UserMinus, UserPlus, UserRound, UserX } from "lucide-react";
import toast from "react-hot-toast";
import {
  type StaffAccountStatus,
  type StaffDirectoryRow,
} from "@/lib/admin/staff-directory-types";

import { PERSON_NAME_MAX_LENGTH } from "@/lib/person-name";

type StaffRoleOption = { key: string; label: string; isAdmin: boolean };

type ConsoleTab = "admins" | "recruiters";

const PAGE_SIZES = [5, 10, 20] as const;
const ADMIN_ROLE_KEYS = new Set(["admin", "owner", "god_admin"]);

const STATUS_STYLES: Record<StaffAccountStatus, string> = {
  pending: "bg-[#FEF3C7] text-[#B45309]",
  active: "bg-[rgba(18,170,0,0.15)] text-[#12AA00]",
  suspended: "bg-[#F1F5F9] text-[#64748B]",
  expired: "bg-[#FFEDD5] text-[#9A3412]",
  failed: "bg-[#FEE2E2] text-[#991B1B]",
};

const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#F8FAFC] disabled:opacity-60";

function formatDateParts(value: string | null): { date: string; time: string } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function isAdminRole(role: string, options: StaffRoleOption[]): boolean {
  const match = options.find((option) => option.key === role);
  if (match) return match.isAdmin;
  return ADMIN_ROLE_KEYS.has(role.trim().toLowerCase());
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
        <p className="mt-2 text-sm text-[#64748B]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#012352] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              danger ? "bg-[#B91C1C]" : "bg-[#012352]"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DateTimeCell({ value }: { value: string | null }) {
  const parts = formatDateParts(value);
  if (!parts) return <span className="text-sm text-[#6B7280]">—</span>;
  return (
    <span className="flex flex-col text-sm leading-5 text-[#6B7280]">
      <span>{parts.date}</span>
      <span>{parts.time}</span>
    </span>
  );
}

function RowActionMenu({
  name,
  open,
  onToggle,
  children,
}: {
  name: string;
  open: boolean;
  onToggle: (next: boolean) => void;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const placeMenu = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = 208;
    const estimatedHeight = 148;
    const openUp = window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight;
    setMenuStyle({
      position: "fixed",
      top: openUp ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
      left: Math.max(8, rect.right - width),
      width,
      zIndex: 40,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onToggle(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onToggle(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onToggle]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for ${name}`}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F8FAFC]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default function AdminConsolePanel({
  embedInSettingsPage = false,
}: {
  embedInSettingsPage?: boolean;
} = {}) {
  const [users, setUsers] = useState<StaffDirectoryRow[]>([]);
  const [roleOptions, setRoleOptions] = useState<StaffRoleOption[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [tab, setTab] = useState<ConsoleTab>("admins");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(5);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    run: () => Promise<void>;
  } | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("recruiter");
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [inviteConflict, setInviteConflict] = useState<StaffDirectoryRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users");
      if (response.status === 403) {
        setVisible(false);
        setUsers([]);
        return;
      }
      const payload = (await response.json()) as {
        users?: StaffDirectoryRow[];
        roles?: StaffRoleOption[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Failed to load users");
      const nextRoles = payload.roles ?? [];
      setRoleOptions(nextRoles);
      setRole((current) =>
        nextRoles.some((option) => option.key === current)
          ? current
          : (nextRoles.find((option) => option.key === "recruiter")?.key ?? nextRoles[0]?.key ?? current)
      );
      setUsers(payload.users ?? []);
      setVisible(true);
    } catch (err) {
      setVisible(true);
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetInviteForm = useCallback(() => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("recruiter");
    setRequirePasswordChange(true);
    setFormError(null);
    setInviteConflict(null);
  }, []);

  function defaultRoleForTab(nextTab: ConsoleTab): string {
    if (nextTab === "admins") {
      return roleOptions.find((option) => option.isAdmin)?.key ?? "admin";
    }
    return roleOptions.find((option) => option.key === "recruiter")?.key
      ?? roleOptions.find((option) => !option.isAdmin)?.key
      ?? "recruiter";
  }

  function openInvite() {
    resetInviteForm();
    setRole(defaultRoleForTab(tab));
    setInviteOpen(true);
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    setInviteConflict(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          role,
          requirePasswordChange,
          origin: window.location.origin,
        }),
      });
      const payload = (await response.json()) as { error?: string; code?: string; user?: StaffDirectoryRow };
      if (!response.ok) {
        setFormError(payload.error || "Could not send invitation.");
        if (payload.code === "CONFLICT") {
          const normalized = email.trim().toLowerCase();
          const match = users.find(
            (row) => row.canResend && row.invitationId && row.email.toLowerCase() === normalized
          );
          setInviteConflict(match ?? null);
        }
        return;
      }
      toast.success(
        payload.user?.status === "pending"
          ? "Invitation sent. They’ll appear as Active after they set a password."
          : `${roleOptions.find((option) => option.key === role)?.label ?? "Staff member"} added to this organization.`
      );
      resetInviteForm();
      setInviteOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(path: string, init: RequestInit, success: string, options?: { closeInvite?: boolean }) {
    setSubmitting(true);
    try {
      const response = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Request failed");
      toast.success(success);
      setMenuId(null);
      if (options?.closeInvite) {
        setInviteOpen(false);
        resetInviteForm();
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
      setResendingId(null);
      setConfirm(null);
    }
  }

  function canResendInvitation(row: StaffDirectoryRow): boolean {
    return row.canResend && Boolean(row.invitationId);
  }

  function resendInvitation(row: StaffDirectoryRow) {
    if (!row.invitationId || submitting) return;
    setResendingId(row.invitationId);
    void runAction(
      `/api/admin/users/invitations/${row.invitationId}`,
      {
        method: "POST",
        body: JSON.stringify({ origin: window.location.origin }),
      },
      "Invitation resent.",
      { closeInvite: true }
    );
  }

  const filteredUsers = useMemo(
    () => users.filter((row) => isAdminRole(row.role, roleOptions) === (tab === "admins")),
    [users, roleOptions, tab]
  );
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!visible && !loading) return null;

  return (
    <section
      className="flex flex-col gap-5"
      style={{ fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif" }}
    >
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-start ${
          embedInSettingsPage ? "sm:justify-end" : "sm:justify-between"
        }`}
      >
        {embedInSettingsPage ? null : (
          <div>
            <h1 className="text-xl font-semibold leading-7 text-black">Admin Console</h1>
            <p className="text-xs font-normal leading-4 text-[#6B7280]">
              Manage system-wide settings, users, and administrative controls.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={openInvite}
          disabled={loading}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Invite User
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#991B1B]">
          {error}
          <button type="button" className="ml-3 font-medium underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex gap-6 border-b border-[#E5E7EB]">
        {(
          [
            ["admins", "Admins"],
            ["recruiters", "Recruiters"],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setPage(1);
                setMenuId(null);
              }}
              className={`-mb-px border-b-2 pb-2.5 text-sm font-medium ${
                active ? "border-[#BC8B41] text-[#111827]" : "border-transparent text-[#6B7280]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg bg-white">
        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            <div className="h-10 animate-pulse rounded-lg bg-[#F1F5F9]" />
            <div className="h-10 animate-pulse rounded-lg bg-[#F8FAFC]" />
            <div className="h-10 animate-pulse rounded-lg bg-[#F8FAFC]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs font-medium text-[#6B7280]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Created by</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Invited</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#6B7280]">
                      {tab === "admins"
                        ? "No admins yet. Invite a user to give them admin access."
                        : "No recruiters yet. Invite a user to give them recruiter access."}
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((row) => (
                    <tr key={row.id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="px-4 py-3.5 text-sm font-medium text-[#111827]">{row.name}</td>
                      <td className="px-4 py-3.5 text-sm text-[#6B7280]">{row.email}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[#6B7280]">{row.roleLabel}</td>
                      <td className="px-4 py-3.5 text-sm text-[#6B7280]">{row.createdByName || "—"}</td>
                      <td className="px-4 py-3.5">
                        <DateTimeCell value={row.lastLogin} />
                      </td>
                      <td className="px-4 py-3.5">
                        <DateTimeCell value={row.invitationDate} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <RowActionMenu
                          name={row.name}
                          open={menuId === row.id}
                          onToggle={(next) => setMenuId(next ? row.id : null)}
                        >
                          {canResendInvitation(row) ? (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={submitting}
                              className={MENU_ITEM_CLASS}
                              onClick={() => resendInvitation(row)}
                            >
                              <Mail className="h-4 w-4 text-[#64748B]" aria-hidden />
                              {resendingId === row.invitationId ? "Resending…" : "Resend invitation"}
                            </button>
                          ) : null}
                          {row.canChangeRole
                            ? roleOptions
                                .filter((option) => option.key !== row.role)
                                .map((option) => (
                                  <button
                                    key={option.key}
                                    type="button"
                                    role="menuitem"
                                    className={MENU_ITEM_CLASS}
                                    onClick={() => {
                                      setConfirm({
                                        title: "Change role",
                                        message: `Change ${row.name} from ${row.roleLabel} to ${option.label}?`,
                                        confirmLabel: "Change role",
                                        run: () =>
                                          runAction(
                                            `/api/admin/users/${row.userId}`,
                                            {
                                              method: "PATCH",
                                              body: JSON.stringify({ action: "change_role", role: option.key }),
                                            },
                                            "Role updated."
                                          ),
                                      });
                                      setMenuId(null);
                                    }}
                                  >
                                    <UserRound className="h-4 w-4 text-[#64748B]" aria-hidden />
                                    Change to {option.label}
                                  </button>
                                ))
                            : null}
                          {row.canSuspend ? (
                            <button
                              type="button"
                              role="menuitem"
                              className={MENU_ITEM_CLASS}
                              onClick={() => {
                                setConfirm({
                                  title: "Disable access",
                                  message: `${row.name} will not be able to sign in to this organization until you enable them again.`,
                                  confirmLabel: "Disable",
                                  danger: true,
                                  run: () =>
                                    runAction(
                                      `/api/admin/users/${row.userId}`,
                                      { method: "PATCH", body: JSON.stringify({ action: "suspend" }) },
                                      "Access disabled."
                                    ),
                                });
                                setMenuId(null);
                              }}
                            >
                              <UserMinus className="h-4 w-4 text-[#64748B]" aria-hidden />
                              Disable
                            </button>
                          ) : null}
                          {row.canReactivate ? (
                            <button
                              type="button"
                              role="menuitem"
                              className={MENU_ITEM_CLASS}
                              onClick={() => {
                                setConfirm({
                                  title: "Enable access",
                                  message: `Restore ${row.name}’s access to this organization?`,
                                  confirmLabel: "Enable",
                                  run: () =>
                                    runAction(
                                      `/api/admin/users/${row.userId}`,
                                      { method: "PATCH", body: JSON.stringify({ action: "reactivate" }) },
                                      "Access restored."
                                    ),
                                });
                                setMenuId(null);
                              }}
                            >
                              <UserCheck className="h-4 w-4 text-[#64748B]" aria-hidden />
                              Enable
                            </button>
                          ) : null}
                          {row.canRemove ? (
                            <button
                              type="button"
                              role="menuitem"
                              className={`${MENU_ITEM_CLASS} text-[#B91C1C] hover:bg-[#FEF2F2]`}
                              onClick={() => {
                                setConfirm({
                                  title: "Remove from organization",
                                  message:
                                    "This removes their access to this organization. Their login identity is kept if they belong to another organization.",
                                  confirmLabel: "Remove",
                                  danger: true,
                                  run: () =>
                                    runAction(
                                      row.kind === "invitation" && row.invitationId
                                        ? `/api/admin/users/invitations/${row.invitationId}`
                                        : `/api/admin/users/${row.userId}`,
                                      { method: "DELETE" },
                                      "Removed from this organization."
                                    ),
                                });
                                setMenuId(null);
                              }}
                            >
                              <UserX className="h-4 w-4" aria-hidden />
                              Remove
                            </button>
                          ) : null}
                        </RowActionMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading ? (
          <div className="flex flex-col gap-3 border-t border-[#E5E7EB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1 text-xs leading-4 whitespace-nowrap">
              <span className="font-normal text-[#6B7280]">Showing</span>
              <span className="font-semibold text-[#374151]">{visibleUsers.length}</span>
              <span className="font-normal text-[#6B7280]">of</span>
              <span className="font-semibold text-[#374151]">{filteredUsers.length}</span>
              <span className="font-normal text-[#6B7280]">results</span>
            </p>
            <div className="flex items-center gap-3.5">
              <label className="flex items-center gap-1.5 text-xs font-normal leading-4 text-[#374151]">
                Show
                <span className="relative">
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]);
                      setPage(1);
                    }}
                    aria-label="Rows per page"
                    className="h-7 w-12 appearance-none rounded-lg border border-[#CBD5E1] bg-white py-1.5 pl-2 pr-5 text-xs leading-4 text-[#374151] outline-none"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <img
                    src="/icons/roles-permissions/chevron-down.svg"
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
        ) : null}
      </div>

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={submitInvite}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-base font-semibold text-[#0F172A]">Invite User</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              We’ll email a one-time activation link. They choose their own password; we never store or display one.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[#0F172A]">First name</span>
                <input
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  maxLength={PERSON_NAME_MAX_LENGTH}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm outline-none focus:border-[#012352]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[#0F172A]">Last name</span>
                <input
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  maxLength={PERSON_NAME_MAX_LENGTH}
                  className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm outline-none focus:border-[#012352]"
                />
              </label>
            </div>
            <label className="mt-3 block space-y-1.5">
              <span className="text-sm font-semibold text-[#0F172A]">Email address</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setInviteConflict(null);
                }}
                className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm outline-none focus:border-[#012352]"
              />
            </label>
            <label className="mt-3 block space-y-1.5">
              <span className="text-sm font-semibold text-[#0F172A]">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm outline-none focus:border-[#012352]"
              >
                {roleOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex items-start gap-3 text-sm text-[#334155]">
              <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
                <input
                  type="checkbox"
                  className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border-2 border-slate-300 bg-white transition-colors checked:border-[color:var(--brand-checkbox,var(--brand-primary))] checked:bg-[color:var(--brand-checkbox,var(--brand-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-checkbox,var(--brand-primary))_30%,transparent)]"
                  checked={requirePasswordChange}
                  onChange={(event) => setRequirePasswordChange(event.target.checked)}
                />
                <Check
                  className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-white peer-checked:block"
                  strokeWidth={3}
                  aria-hidden
                />
              </span>
              <span>Require password setup before first login (recommended). They activate with a one-time email link.</span>
            </label>
            {formError ? <p className="mt-3 text-sm text-[#B91C1C]">{formError}</p> : null}
            {inviteConflict ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => resendInvitation(inviteConflict)}
                className="mt-2 text-sm font-medium text-[#012352] hover:underline disabled:opacity-60"
              >
                {resendingId === inviteConflict.invitationId ? "Resending…" : "Resend invitation"}
              </button>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setInviteOpen(false)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#012352]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#012352] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          busy={submitting}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void confirm.run()}
        />
      ) : null}
    </section>
  );
}
