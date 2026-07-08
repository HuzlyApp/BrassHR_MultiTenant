"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import SidebarNavIcon from "@/app/admin_recruiter/components/SidebarNavIcon";
import { HeaderIconCountBadge } from "@/app/components/HeaderIconCountBadge";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerPortalUserAvatar } from "./WorkerPortalUserAvatar";

const SIDEBAR_TOGGLE_ICON = "/icons/sidebar-on-off-icon.svg";

type WorkerNotification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

type Props = {
  applicantName: string;
  mobileNavOpen?: boolean;
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
  onOpenMessages?: () => void;
};

export function ApplicantPortalHeader({
  applicantName,
  mobileNavOpen = false,
  onMenuClick,
  onSidebarToggle,
  sidebarCollapsed = false,
  onOpenMessages,
}: Props) {
  const router = useRouter();
  const { profilePhotoUrl, authHeaders } = useApplicantPortal();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const actionsAreaRef = useRef<HTMLDivElement>(null);
  const firstName = applicantName.split(" ")[0] || "Worker";

  const loadNotifications = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;

    const res = await fetch("/api/applicant-portal/notifications", {
      headers,
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      notifications?: WorkerNotification[];
      unreadNotifications?: number;
    };
    if (!res.ok) return;

    setNotifications(payload.notifications ?? []);
    setUnreadNotifications(payload.unreadNotifications ?? 0);
  }, [authHeaders]);

  const markNotificationsRead = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;

    const res = await fetch("/api/applicant-portal/notifications", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notifications_read" }),
    });
    if (!res.ok) return;

    setUnreadNotifications(0);
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  }, [authHeaders]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    void markNotificationsRead();
  }, [notificationsOpen, markNotificationsRead]);

  useEffect(() => {
    if (!profileOpen && !notificationsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileAreaRef.current && !profileAreaRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (actionsAreaRef.current && !actionsAreaRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen, notificationsOpen]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await supabaseBrowser.auth.signOut();
      router.replace("/");
    } catch (error) {
      console.error("[ApplicantPortalHeader] logout failed", error);
      setLoggingOut(false);
    }
  }

  return (
    <header className="worker-portal-topbar sticky top-0 z-30 bg-white">
      <div className="flex h-full items-center gap-2 px-4 min-[1000px]:gap-3 min-[1000px]:px-8 max-[999px]:px-3 max-[499px]:pl-4 max-[499px]:pr-2">
        <div className="flex shrink-0 items-center gap-2">
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-8 w-8 items-center justify-center bg-transparent text-[#64748B] transition hover:text-[#0F3B76] min-[1000px]:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              title="Open menu"
            >
              <Image
                src={SIDEBAR_TOGGLE_ICON}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
            </button>
          ) : null}
          {onSidebarToggle ? (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="hidden h-8 w-8 items-center justify-center bg-transparent text-[#64748B] transition hover:text-[#0F3B76] min-[1000px]:inline-flex"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            >
              <Image
                src={SIDEBAR_TOGGLE_ICON}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
            </button>
          ) : null}
        </div>

        <div className="hidden flex-1 justify-center min-[1000px]:flex">
          <label className="relative w-full max-w-[520px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              placeholder="Search anything"
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-10 pr-4 text-[14px] text-[#012352] outline-none placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)]"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div ref={actionsAreaRef} className="relative flex items-center gap-0">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(false);
                onOpenMessages?.();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F8FAFC]"
              aria-label="Open messages"
            >
              <SidebarNavIcon iconType="Chat" active={false} />
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                setNotificationsOpen((prev) => !prev);
              }}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F8FAFC]"
              aria-label={`Open notifications${unreadNotifications > 0 ? `, ${unreadNotifications} unread` : ""}`}
              aria-expanded={notificationsOpen}
            >
              <SidebarNavIcon iconType="Notifications" active={false} />
              <HeaderIconCountBadge count={unreadNotifications} />
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 top-10 z-50 w-[320px] overflow-hidden rounded-lg border border-[#d7e4e1] bg-white shadow-xl">
                <div className="border-b border-[#E2E8F0] px-4 py-3">
                  <p className="text-sm font-semibold text-[#0F172A]">Notifications</p>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-[#64748B]">No notifications yet.</p>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`border-b border-[#F1F5F9] px-4 py-3 ${notification.is_read ? "opacity-70" : "bg-[#F8FAFC]"}`}
                      >
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {notification.title?.trim() || "Notification"}
                        </p>
                        {notification.body ? (
                          <p className="mt-1 text-sm text-[#64748B]">{notification.body}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div ref={profileAreaRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(false);
                setProfileOpen((prev) => !prev);
              }}
              className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-2.5 py-1.5"
            >
              <WorkerPortalUserAvatar name={applicantName} photoUrl={profilePhotoUrl} size={30} />
              <span className="hidden text-[14px] font-semibold text-black sm:inline">{firstName}.</span>
              <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-[#E2E8F0] bg-white p-2 shadow-lg">
                <p className="px-2 py-1 text-[12px] font-semibold text-[#012352]">{applicantName}</p>
                <p className="px-2 pb-2 text-[11px] text-[#64748B]">Worker</p>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="mt-1 block w-full rounded-md px-2 py-1 text-left text-xs text-[#0F172A] hover:bg-[#f2f8f7] disabled:opacity-60"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
