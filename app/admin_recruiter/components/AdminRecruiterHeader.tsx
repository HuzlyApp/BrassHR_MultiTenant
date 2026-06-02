"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, Menu } from "lucide-react";

const SIDEBAR_TOGGLE_ICON = "/icons/sidebar-on-off-icon.svg";
import { useEffect, useMemo, useState } from "react";
import GodAdminTenantSwitcher from "./GodAdminTenantSwitcher";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

type HeaderProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  profile_photo: string | null;
  email: string | null;
};

type HeaderNotification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

type ConversationItem = {
  id: string;
  counterpartId: string;
  counterpartName: string;
  preview: string;
  sentAt: string | null;
  unreadCount: number;
  href: string;
};

type HeaderDataResponse = {
  userId: string;
  profile: HeaderProfile | null;
  notifications: HeaderNotification[];
  conversations: ConversationItem[];
  unreadNotifications: number;
  unreadMessages: number;
};

type AdminRecruiterHeaderProps = {
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
};

const DEFAULT_TENANT_LOGO = "/images/new-logo-nexus.svg";

export function AdminRecruiterHeader({
  onMenuClick,
  sidebarCollapsed = false,
  onSidebarToggle,
}: AdminRecruiterHeaderProps) {
  const branding = useTenantBranding();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [tenantLogoSrc, setTenantLogoSrc] = useState(branding.logoUrl || DEFAULT_TENANT_LOGO);

  useEffect(() => {
    console.log("[AdminRecruiterHeader] current route", pathname);
  }, [pathname]);

  useEffect(() => {
    setTenantLogoSrc(branding.logoUrl?.trim() || DEFAULT_TENANT_LOGO);
  }, [branding.logoUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadHeaderData = async () => {
      setLoading(true);

      const response = await fetch("/api/admin/header-data", { cache: "no-store" });
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        const isAuthError = response.status === 401 || response.status === 403;
        if (isAuthError) {
          const next = `${pathname || "/admin_recruiter"}${window.location.search}`;
          const nextParam = encodeURIComponent(next);
          router.replace(
            response.status === 403
              ? `/login?next=${nextParam}&error=platform`
              : `/login?next=${nextParam}`
          );
          return;
        }
        // console.error("[AdminRecruiterHeader] Supabase error", errPayload);
        if (!cancelled) {
          setCurrentUserId(null);
          setProfile(null);
          setNotifications([]);
          setConversations([]);
          setLoading(false);
        }
        return;
      }

      const payload = (await response.json()) as HeaderDataResponse;
      const profileData = payload.profile ?? null;
      const notificationsData = payload.notifications ?? [];
      const conversationData = payload.conversations ?? [];

      if (!cancelled) {
        setCurrentUserId(payload.userId);
        setProfile(profileData);
        setNotifications(notificationsData);
        setConversations(conversationData);
        setLoading(false);
      }

      console.log("[AdminRecruiterHeader] logged-in user ID", payload.userId);
      console.log("[AdminRecruiterHeader] fetched profile data", profileData);
      console.log("[AdminRecruiterHeader] fetched notifications count", notificationsData.length);
      console.log("[AdminRecruiterHeader] fetched messages count", conversationData.length);
    };

    void loadHeaderData();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );
  const unreadMessages = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  const onOpenNotifications = async () => {
    setShowNotifications((prev) => !prev);
    setShowMessages(false);
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!currentUserId || unreadIds.length === 0) return;
    const response = await fetch("/api/admin/header-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notifications_read" }),
    });
    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      console.error("[AdminRecruiterHeader] Supabase error", errPayload);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    "Unknown User";
  const displayRole = profile?.role ?? "User";

  return (
    <header
      className="sticky top-0 z-40 w-full bg-white border-b border-[#E2E8F0]"
      style={{ borderColor: "color-mix(in srgb, var(--brand-accent) 35%, #E2E8F0)" }}
    >
      <div className="flex h-[68px] w-full items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-8 w-8 items-center justify-center bg-transparent text-[#64748B] transition hover:text-[#0F3B76] lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {onSidebarToggle ? (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="hidden h-8 w-8 items-center justify-center bg-transparent text-[#64748B] transition hover:text-[#0F3B76] lg:inline-flex"
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
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-8 w-8 items-center justify-center bg-transparent text-[#64748B] transition hover:text-[#0F3B76]"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 relative">
          <GodAdminTenantSwitcher />

          <div className="flex items-center gap-2">
            <img
              src={profile?.profile_photo || "https://i.pravatar.cc/128?u=fallback-user"}
              alt={displayName}
              width={30}
              height={30}
              className="h-[30px] w-[30px] rounded-full object-cover"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[#0F172A]">{loading ? "Loading..." : displayName}</p>
              <p className="text-[11px] text-[#64748B]">{displayRole}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-slate-100"
              aria-label="Open profile menu"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setShowMessages((prev) => !prev);
                setShowNotifications(false);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-slate-100"
              aria-label="Chat"
            >
              <Image src="/icons/admin-recruiter/chat.svg" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
              {unreadMessages > 0 ? (
                <span
                  className="absolute -mt-6 ml-6 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Image src="/icons/admin-recruiter/bell-02.svg" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
              {unreadNotifications > 0 ? (
                <span
                  className="absolute -mt-6 ml-6 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </button>
          </div>

          {showMessages ? (
            <div className="absolute right-10 top-12 w-[360px] rounded-lg border border-[#d7e4e1] bg-white p-3 shadow-xl">
              <p className="mb-2 text-sm font-semibold text-[#0F172A]">Messages</p>
              {conversations.length === 0 ? (
                <p className="py-4 text-xs text-[#64748B]">No messages yet.</p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  {conversations.map((conversation) => (
                    <Link
                      key={conversation.id}
                      href={conversation.href}
                      className="mb-1 block rounded-md px-2 py-2 hover:bg-[#f2f8f7]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#0F172A]">{conversation.counterpartName}</p>
                        {conversation.unreadCount > 0 ? (
                          <span className="rounded-full bg-[#0b5551] px-1.5 py-0.5 text-[10px] text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] text-[#64748B]">{conversation.preview}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {showNotifications ? (
            <div className="absolute right-0 top-12 w-[360px] rounded-lg border border-[#d7e4e1] bg-white p-3 shadow-xl">
              <p className="mb-2 text-sm font-semibold text-[#0F172A]">Notifications</p>
              {notifications.length === 0 ? (
                <p className="py-4 text-xs text-[#64748B]">No notifications yet.</p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.map((item) => (
                    <div key={item.id} className="mb-1 rounded-md px-2 py-2 hover:bg-[#f2f8f7]">
                      <p className="text-xs font-semibold text-[#0F172A]">{item.title || item.type || "Notification"}</p>
                      <p className="text-[11px] text-[#64748B]">{item.body || "No message body"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {showProfileMenu ? (
            <div className="absolute right-[112px] top-12 w-[220px] rounded-lg border border-[#d7e4e1] bg-white p-2 shadow-xl">
              <div className="mb-1 flex items-center gap-2 px-2">
                <img
                  src={tenantLogoSrc}
                  alt={branding.companyName}
                  className="h-4 w-4 object-contain"
                  onError={() => setTenantLogoSrc(DEFAULT_TENANT_LOGO)}
                />
                <span className="truncate text-[11px] text-[#64748B]">{branding.companyName}</span>
              </div>
              <p className="px-2 py-1 text-xs font-semibold text-[#0F172A]">{displayName}</p>
              <p className="px-2 pb-2 text-[11px] text-[#64748B]">{displayRole}</p>
              <Link href="/admin_recruiter/settings" className="block rounded-md px-2 py-1 text-xs text-[#0F172A] hover:bg-[#f2f8f7]">
                Settings
              </Link>
              <button
                type="button"
                onClick={async () => {
                  const { error } = await supabaseBrowser.auth.signOut();
                  if (error) {
                    console.error("[AdminRecruiterHeader] Supabase error", error);
                    return;
                  }
                  router.push("/login");
                }}
                className="mt-1 block w-full rounded-md px-2 py-1 text-left text-xs text-[#0F172A] hover:bg-[#f2f8f7]"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
