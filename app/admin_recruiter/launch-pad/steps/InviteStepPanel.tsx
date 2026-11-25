"use client";

import { CheckCircle2, Plus, UserRound, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import toast from "react-hot-toast";
import SettingsSelect from "@/app/admin_recruiter/settings/SettingsSelect";
import { SEEDED_STAFF_ROLES } from "@/lib/admin/staff-roles";
import { InviteAddModal, type InviteDraftInput } from "./InviteAddModal";
import { interStyle } from "../constants";

type InviteRow = InviteDraftInput & {
  id: string;
  status: "pending" | "sent";
  sending?: boolean;
  /** True when hydrated from the staff directory (already invited). */
  fromServer?: boolean;
};

type DirectoryUser = {
  id: string;
  kind?: "member" | "invitation";
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Manage company settings and user access",
  finance: "Manage payroll and billing",
  hr: "Manage people and compliance",
  manager: "Manage teams and scheduling",
  recruiter: "Manage jobs and candidates",
  support: "Help applicants and workers",
};

const FALLBACK_ROLE_OPTIONS = SEEDED_STAFF_ROLES.filter((role) => role.isAssignable).map((role) => ({
  value: role.key,
  label: role.label,
}));

function createRowId() {
  return `invite-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeInviteRole(
  role: string | null | undefined,
  options: Array<{ value: string }>
): string {
  const token = (role ?? "").trim().toLowerCase();
  if (options.some((option) => option.value === token)) return token;
  if (token === "client") return "recruiter";
  if (token === "owner") return "admin";
  return options.find((option) => option.value === "recruiter")?.value ?? options[0]?.value ?? "recruiter";
}

function shouldShowAsSentInvite(user: DirectoryUser): boolean {
  const status = (user.status ?? "").trim().toLowerCase();
  if (user.kind === "invitation") {
    return status === "pending" || status === "failed" || status === "expired";
  }
  // Invited members who have not finished setup yet.
  return status === "pending";
}

function directoryUserToRow(
  user: DirectoryUser,
  options: Array<{ value: string }>
): InviteRow | null {
  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email) return null;
  return {
    id: user.id || createRowId(),
    firstName: String(user.firstName ?? "").trim() || "Teammate",
    lastName: String(user.lastName ?? "").trim() || "Invite",
    email,
    role: normalizeInviteRole(user.role, options),
    status: "sent",
    fromServer: true,
  };
}

async function sendInviteRequest(row: InviteDraftInput) {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      role: row.role,
      requirePasswordChange: true,
      origin: window.location.origin,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not send invite");
}

export function InviteStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const bannerId = useId();
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [roleOptions, setRoleOptions] = useState(FALLBACK_ROLE_OPTIONS);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bannerEmails, setBannerEmails] = useState<string[]>([]);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingExisting(true);
      try {
        const response = await fetch("/api/admin/users", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as {
          roles?: Array<{ key: string; label: string }>;
          users?: DirectoryUser[];
        };
        if (!response.ok || cancelled) return;

        const nextRoles =
          data.roles && data.roles.length > 0
            ? data.roles.map((role) => ({
                value: role.key,
                label: role.label,
              }))
            : FALLBACK_ROLE_OPTIONS;
        setRoleOptions(nextRoles);

        const existing = (data.users ?? [])
          .filter(shouldShowAsSentInvite)
          .map((user) => directoryUserToRow(user, nextRoles))
          .filter((row): row is InviteRow => Boolean(row));

        // Keep any local pending drafts; merge server sent invites by email.
        setRows((current) => {
          const pendingLocal = current.filter((row) => row.status === "pending" && !row.fromServer);
          const byEmail = new Map<string, InviteRow>();
          for (const row of existing) byEmail.set(row.email.toLowerCase(), row);
          for (const row of pendingLocal) {
            if (!byEmail.has(row.email.toLowerCase())) byEmail.set(row.email.toLowerCase(), row);
          }
          return [...byEmail.values()];
        });
      } catch {
        // Keep seeded role options / empty list.
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const sentCount = rows.filter((row) => row.status === "sent").length;

  const roleCounts = roleOptions.reduce<Record<string, number>>((acc, option) => {
    acc[option.value] = rows.filter((row) => row.role === option.value).length;
    return acc;
  }, {});

  const updateRow = (id: string, patch: Partial<InviteRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    const target = rows.find((row) => row.id === id);
    if (target?.fromServer || target?.status === "sent") {
      setError("Sent invites stay on the list. Manage them anytime in Settings > Users.");
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const markSent = (emails: string[]) => {
    if (emails.length === 0) return;
    setBannerEmails(emails);
    setBannerOpen(true);
  };

  const handleAddToList = (draft: InviteDraftInput): boolean => {
    const exists = rows.some((row) => row.email.toLowerCase() === draft.email.toLowerCase());
    if (exists) {
      setError("That email is already on the invite list.");
      return false;
    }
    setError(null);
    setRows((current) => [
      ...current,
      {
        id: createRowId(),
        ...draft,
        status: "pending",
      },
    ]);
    return true;
  };

  const handleAddAndSend = async (draft: InviteDraftInput) => {
    const exists = rows.some((row) => row.email.toLowerCase() === draft.email.toLowerCase());
    if (exists) {
      throw new Error("That email is already on the invite list.");
    }
    const id = createRowId();
    setError(null);
    setRows((current) => [
      ...current,
      {
        id,
        ...draft,
        status: "pending",
        sending: true,
      },
    ]);
    try {
      await sendInviteRequest(draft);
      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, status: "sent", sending: false, fromServer: true } : row
        )
      );
      markSent([draft.email]);
      toast.success("Invite sent successfully.");
    } catch (cause) {
      setRows((current) => current.filter((row) => row.id !== id));
      throw new Error(
        cause instanceof Error && cause.message && !/offline|network|fetch/i.test(cause.message)
          ? cause.message
          : "Could not send invite. Please try again."
      );
    }
  };

  const handleSendOne = async (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row || row.status === "sent" || row.sending) return;
    setError(null);
    updateRow(id, { sending: true });
    try {
      await sendInviteRequest(row);
      updateRow(id, { status: "sent", sending: false });
      markSent([row.email]);
      toast.success("Invite sent successfully.");
    } catch (cause) {
      updateRow(id, { sending: false });
      setError(
        cause instanceof Error && cause.message && !/offline|network|fetch/i.test(cause.message)
          ? cause.message
          : "Could not send invite. Please try again."
      );
    }
  };

  const handleSendAllPending = async () => {
    const pending = rows.filter((row) => row.status === "pending");
    if (pending.length === 0) {
      setError("Add teammates to the list before sending invites.");
      return;
    }
    setBulkSending(true);
    setError(null);
    const sentEmails: string[] = [];
    try {
      for (const row of pending) {
        updateRow(row.id, { sending: true });
        await sendInviteRequest(row);
        updateRow(row.id, { status: "sent", sending: false });
        sentEmails.push(row.email);
      }
      markSent(sentEmails);
      toast.success(
        sentEmails.length === 1
          ? "Invite sent successfully."
          : `${sentEmails.length} invites sent successfully.`
      );
    } catch (cause) {
      setRows((current) =>
        current.map((row) => (row.sending ? { ...row, sending: false } : row))
      );
      setError(cause instanceof Error ? cause.message : "Could not send invite. Please try again.");
    } finally {
      setBulkSending(false);
    }
  };

  const handleContinue = () => {
    if (pendingCount > 0) {
      setError("Send remaining invites, or remove them, before continuing.");
      return;
    }
    onComplete();
  };

  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[1104px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5">
          {bannerOpen && bannerEmails.length > 0 ? (
            <div
              role="status"
              aria-labelledby={bannerId}
              className="flex items-start gap-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#16A34A]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p id={bannerId} className="text-[13px] font-semibold text-[#166534]" style={interStyle}>
                  Invites sent to {bannerEmails.length}{" "}
                  {bannerEmails.length === 1 ? "person" : "people"}! They&apos;ll get an email to join.
                </p>
                <p className="mt-1 break-all text-[12px] text-[#15803D]" style={interStyle}>
                  {bannerEmails.join(", ")}
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss invite success"
                onClick={() => setBannerOpen(false)}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#166534] hover:bg-[#DCFCE7]"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              Invite your team
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              Add teammates to the list, then send invites. Use Skip if you want to do this later.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {loadingExisting ? (
              <p role="status" className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-6 text-center text-[13px] text-[#6B7280]" style={interStyle}>
                Loading invites…
              </p>
            ) : rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-4 py-6 text-center text-[13px] text-[#6B7280]" style={interStyle}>
                No invites yet. Click Add another to add someone to the list.
              </p>
            ) : (
              rows.map((row) => {
                const sent = row.status === "sent";
                return (
                  <div key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="email"
                      aria-label={`Email for ${row.firstName} ${row.lastName}`}
                      value={row.email}
                      disabled={sent || row.sending}
                      onChange={(e) => updateRow(row.id, { email: e.target.value })}
                      className={`h-10 min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352] disabled:bg-[#F3F4F6] disabled:text-[#6B7280] ${
                        sent ? "bg-[#F3F4F6]" : "bg-white"
                      }`}
                      style={interStyle}
                    />
                    <div className="w-full sm:w-[160px]">
                      <SettingsSelect
                        aria-label={`Role for ${row.email}`}
                        value={row.role}
                        options={roleOptions}
                        onChange={(value) => updateRow(row.id, { role: value })}
                        disabled={sent || row.sending}
                        size="sm"
                        className="w-full"
                        accentHex="#012352"
                        triggerClassName={`h-10 w-full justify-between rounded-lg border border-[#E5E7EB] px-3 pr-3 text-[14px] ${
                          sent
                            ? "bg-[#F3F4F6] text-[#6B7280]"
                            : "bg-white text-black hover:bg-white focus-visible:border-[#012352]"
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${row.email}`}
                      disabled={row.sending || row.status === "sent" || row.fromServer}
                      onClick={() => removeRow(row.id)}
                      className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <X className="size-4" />
                    </button>
                    {sent ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-lg bg-[#E5E7EB] px-3 text-[13px] font-semibold text-[#4B5563] sm:w-[118px]"
                        style={interStyle}
                      >
                        Invite Sent
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(row.sending) || bulkSending}
                        onClick={() => void handleSendOne(row.id)}
                        className="inline-flex h-10 w-full shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#012352] px-3 text-[13px] font-semibold text-white disabled:opacity-60 sm:w-[118px]"
                        style={interStyle}
                      >
                        {row.sending ? "Sending…" : "Send Invite"}
                      </button>
                    )}
                  </div>
                );
              })
            )}

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex w-fit cursor-pointer items-center gap-2 text-[13px] font-semibold text-[#012352]"
              style={interStyle}
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full border border-[#012352]">
                <Plus className="size-3.5" strokeWidth={2.5} />
              </span>
              Add another
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roleOptions.map((option) => (
              <div
                key={option.value}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#E8EEF6] text-[#012352]">
                    <UserRound className="size-4" aria-hidden />
                  </span>
                  <span className="inline-flex h-6 items-center gap-1 rounded-md bg-[#F3F4F6] px-2 text-[11px] font-semibold text-[#374151]">
                    <UserRound className="size-3" aria-hidden />
                    {roleCounts[option.value] ?? 0}
                  </span>
                </div>
                <p className="mt-3 text-[14px] font-semibold text-black" style={interStyle}>
                  {option.label}
                </p>
                <p className="mt-1 text-[12px] leading-4 text-[#6B7280]" style={interStyle}>
                  {ROLE_DESCRIPTIONS[option.value] ?? "Invite someone with this role."}
                </p>
              </div>
            ))}
          </div>

          {error ? (
            <p role="alert" className="text-[12px] text-[#DC2626]" style={interStyle}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex w-full items-center justify-between border-t border-[#E5E7EB] px-5 py-[15px]">
          <button
            type="button"
            onClick={onSkip}
            className="text-[12px] font-semibold leading-4 text-[#012352]"
            style={interStyle}
          >
            Skip for now
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#012352] bg-white px-3.5 text-[14px] font-semibold text-[#012352]"
              style={interStyle}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#012352] bg-white px-3.5 text-[14px] font-semibold text-[#012352]"
              style={interStyle}
            >
              Continue
            </button>
            <button
              type="button"
              disabled={bulkSending || pendingCount === 0}
              onClick={() => void handleSendAllPending()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#012352] px-3.5 text-[14px] font-semibold text-white disabled:opacity-60"
              style={interStyle}
            >
              {bulkSending ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </div>
      </div>

      <InviteAddModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        roleOptions={roleOptions}
        onAdd={handleAddToList}
        onAddAndSend={handleAddAndSend}
      />

      {sentCount > 0 ? <span className="sr-only">{sentCount} invites sent</span> : null}
    </div>
  );
}
