"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import toast from "react-hot-toast";
import AccountCheckbox from "@/app/admin_recruiter/account/components/AccountCheckbox";
import {
  createDefaultNotificationSettings,
  formatQuietHourLabel,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SETTINGS_STORAGE_KEY,
  QUIET_HOUR_OPTIONS,
  type NotificationCategoryId,
  type NotificationChannelTab,
  type NotificationEventId,
  type NotificationSettingsState,
} from "@/lib/notifications/settings-catalog";

function BrandToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[color:var(--brand-secondary)]" : "bg-[#CBD5E1]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function loadStoredSettings(): NotificationSettingsState {
  const defaults = createDefaultNotificationSettings();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<NotificationSettingsState>;
    return {
      ...defaults,
      ...parsed,
      inApp: {
        categoriesEnabled: {
          ...defaults.inApp.categoriesEnabled,
          ...(parsed.inApp?.categoriesEnabled ?? {}),
        },
        events: {
          ...defaults.inApp.events,
          ...(parsed.inApp?.events ?? {}),
        },
      },
      push: {
        categoriesEnabled: {
          ...defaults.push.categoriesEnabled,
          ...(parsed.push?.categoriesEnabled ?? {}),
        },
        events: {
          ...defaults.push.events,
          ...(parsed.push?.events ?? {}),
        },
      },
    };
  } catch {
    return defaults;
  }
}

function CategoryCard({
  title,
  description,
  enabled,
  onToggleCategory,
  events,
  eventValues,
  onToggleEvent,
  disabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggleCategory: (next: boolean) => void;
  events: Array<{ id: NotificationEventId; label: string }>;
  eventValues: Record<NotificationEventId, boolean>;
  onToggleEvent: (id: NotificationEventId, next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5 text-[#0F172A]">{title}</h3>
          <p className="mt-0.5 text-xs leading-[15px] text-[#6B7280]">{description}</p>
        </div>
        <BrandToggle
          checked={enabled}
          onChange={onToggleCategory}
          disabled={disabled}
          label={`Enable ${title}`}
        />
      </div>
      <div
        className={`mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 ${
          enabled ? "" : "pointer-events-none opacity-45"
        }`}
      >
        {events.map((event) => (
          <label
            key={event.id}
            className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-[#374151]"
          >
            <AccountCheckbox
              brand="secondary"
              className="mt-0.5"
              checked={enabled && eventValues[event.id]}
              disabled={disabled || !enabled}
              onChange={(e) => onToggleEvent(event.id, e.target.checked)}
            />
            <span>{event.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export default function NotificationsSettingsPanel() {
  const defaults = useMemo(() => createDefaultNotificationSettings(), []);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<NotificationChannelTab>("in_app");
  const [draft, setDraft] = useState<NotificationSettingsState>(defaults);
  const [baseline, setBaseline] = useState<NotificationSettingsState>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = loadStoredSettings();
    setDraft(stored);
    setBaseline(stored);
    setHydrated(true);
  }, []);

  const channel = tab === "in_app" ? draft.inApp : draft.push;
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [baseline, draft]
  );

  const updateChannel = useCallback(
    (
      updater: (
        current: NotificationSettingsState["inApp"]
      ) => NotificationSettingsState["inApp"]
    ) => {
      setDraft((prev) => {
        const key = tab === "in_app" ? "inApp" : "push";
        return { ...prev, [key]: updater(prev[key]) };
      });
    },
    [tab]
  );

  const setCategoryEnabled = (categoryId: NotificationCategoryId, next: boolean) => {
    updateChannel((current) => {
      const category = NOTIFICATION_CATEGORIES.find((item) => item.id === categoryId);
      const events = { ...current.events };
      if (category) {
        for (const event of category.events) {
          events[event.id] = next;
        }
      }
      return {
        ...current,
        categoriesEnabled: { ...current.categoriesEnabled, [categoryId]: next },
        events,
      };
    });
  };

  const setEventEnabled = (eventId: NotificationEventId, next: boolean) => {
    updateChannel((current) => ({
      ...current,
      events: { ...current.events, [eventId]: next },
    }));
  };

  const handleCancel = () => {
    setDraft(baseline);
    toast.success("Changes discarded");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      window.localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(draft));
      setBaseline(draft);
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Could not save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-72 rounded-md bg-[#E5E7EB]" />
        <div className="h-40 rounded-xl bg-[#E5E7EB]" />
        <div className="h-40 rounded-xl bg-[#E5E7EB]" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div>
        <h1 className="text-xl font-semibold leading-7 tracking-tight text-[#101828]">
          Notifications
        </h1>
        <p className="mt-1 text-sm leading-5 text-[#6B7280]">
          Choose what you want to be notified about and how you want to receive them.
        </p>
      </div>

      <div
        className="flex items-end gap-8 border-b border-[#E5E7EB]"
        role="tablist"
        aria-label="Notification channel"
      >
        {(
          [
            { id: "in_app" as const, label: "In-App Notifications", showBadge: false },
            { id: "push" as const, label: "Push Notifications", showBadge: true },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`relative inline-flex items-center gap-2 pb-3 text-sm font-semibold transition ${
                active
                  ? "text-[color:var(--brand-primary)]"
                  : "text-[#012352] hover:text-[color:var(--brand-primary)]"
              }`}
            >
              <span className="relative inline-flex shrink-0">
                <Bell
                  className="h-4 w-4"
                  strokeWidth={1.75}
                  style={{ color: active ? "var(--brand-primary)" : "#012352" }}
                  aria-hidden
                />
                {item.showBadge ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className="max-[520px]:hidden">{item.label}</span>
              <span className="hidden max-[520px]:inline">
                {item.id === "in_app" ? "In-App" : "Push"}
              </span>
              {active ? (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <CategoryCard
              key={`${tab}-${category.id}`}
              title={category.title}
              description={category.description}
              enabled={channel.categoriesEnabled[category.id]}
              onToggleCategory={(next) => setCategoryEnabled(category.id, next)}
              events={category.events}
              eventValues={channel.events}
              onToggleEvent={setEventEnabled}
              disabled={saving}
            />
          ))}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#0F172A]">Notification Preference</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">Email Digest</p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">
                    Receive a daily or weekly summary.
                  </p>
                </div>
                <BrandToggle
                  checked={draft.emailDigest}
                  onChange={(next) => setDraft((prev) => ({ ...prev, emailDigest: next }))}
                  disabled={saving}
                  label="Email Digest"
                />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">Push Notifications</p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">
                    Allow browser / device push alerts.
                  </p>
                </div>
                <BrandToggle
                  checked={draft.pushEnabled}
                  onChange={(next) => setDraft((prev) => ({ ...prev, pushEnabled: next }))}
                  disabled={saving}
                  label="Push Notifications"
                />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">Desktop alerts</p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">
                    Show desktop banners while you are signed in.
                  </p>
                </div>
                <BrandToggle
                  checked={draft.desktopPush}
                  onChange={(next) => setDraft((prev) => ({ ...prev, desktopPush: next }))}
                  disabled={saving}
                  label="Desktop alerts"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#0F172A]">Quiet Hours</h3>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  Pause non-critical notifications during specific hours.
                </p>
              </div>
              <BrandToggle
                checked={draft.quietHoursEnabled}
                onChange={(next) => setDraft((prev) => ({ ...prev, quietHoursEnabled: next }))}
                disabled={saving}
                label="Enable quiet hours"
              />
            </div>

            <div
              className={`mt-4 grid grid-cols-2 gap-3 ${
                draft.quietHoursEnabled ? "" : "pointer-events-none opacity-45"
              }`}
            >
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#374151]">From</span>
                <select
                  value={draft.quietHoursFrom}
                  disabled={saving || !draft.quietHoursEnabled}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, quietHoursFrom: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
                >
                  {QUIET_HOUR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatQuietHourLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#374151]">To</span>
                <select
                  value={draft.quietHoursTo}
                  disabled={saving || !draft.quietHoursEnabled}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, quietHoursTo: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
                >
                  {QUIET_HOUR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatQuietHourLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs leading-[15px] text-[#6B7280]">
              You will still receive critical notifications (e.g. security alerts).
            </p>
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving || !isDirty}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-5 text-sm font-medium text-[#012352] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !isDirty}
              className="inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
