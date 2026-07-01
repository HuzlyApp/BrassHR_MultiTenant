"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { FIELD, FieldLabel } from "./account-form-fields";
import AccountCheckbox from "./AccountCheckbox";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSaveButton,
  AccountSuccessBanner,
} from "./AccountFormStatus";
import {
  buildTimezoneSelectOptions,
  groupTimezoneOptionsByRegion,
  type UsTimezoneOption,
} from "@/lib/account/us-timezones";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
];

const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

const THEME_OPTIONS = ["system", "light", "dark"];

export default function AccountPreferencesPanel() {
  const { user, settings, loading, error, refresh } = useAccountData();

  const [timezone, setTimezone] = useState("America/New_York");
  const [language, setLanguage] = useState("en");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [theme, setTheme] = useState("system");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  const [timezoneCatalog, setTimezoneCatalog] = useState<UsTimezoneOption[]>([]);
  const [timezoneCatalogLoading, setTimezoneCatalogLoading] = useState(true);
  const [timezoneCatalogError, setTimezoneCatalogError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const timezoneOptions = useMemo(
    () => buildTimezoneSelectOptions(timezoneCatalog, timezone),
    [timezoneCatalog, timezone]
  );
  const timezoneRegions = useMemo(
    () => groupTimezoneOptionsByRegion(timezoneOptions),
    [timezoneOptions]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTimezoneOptions() {
      setTimezoneCatalogLoading(true);
      setTimezoneCatalogError(null);
      try {
        const res = await fetch("/api/account/timezone-options", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          options?: UsTimezoneOption[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || "Failed to load timezones");
        }
        if (!cancelled) {
          setTimezoneCatalog(json.options ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setTimezoneCatalog([]);
          setTimezoneCatalogError(
            err instanceof Error ? err.message : "Failed to load timezones"
          );
        }
      } finally {
        if (!cancelled) {
          setTimezoneCatalogLoading(false);
        }
      }
    }

    void loadTimezoneOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    setTimezone(settings.timezone);
    setLanguage(settings.language);
    setDateFormat(settings.date_format);
    setTheme(settings.theme);
    setEmailNotifications(settings.email_notifications);
    setSmsNotifications(settings.sms_notifications);
    setPushNotifications(settings.push_notifications);
    setMarketingEmails(settings.marketing_emails);
  }, [settings]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          language,
          date_format: dateFormat,
          theme,
          email_notifications: emailNotifications,
          sms_notifications: smsNotifications,
          push_notifications: pushNotifications,
          marketing_emails: marketingEmails,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to save settings");
      }

      await refresh();
      setSaveSuccess("Account settings saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AccountLoadingSkeleton rows={5} />;
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold leading-7 text-[#012352]">Preferences</h2>
      <p className="mt-1 text-sm text-[#64748B]">Timezone, language, and notification settings.</p>

      {error ? <AccountErrorBanner message={error} /> : null}
      {timezoneCatalogError ? <AccountErrorBanner message={timezoneCatalogError} /> : null}
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Timezone</FieldLabel>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={FIELD}
            disabled={timezoneCatalogLoading || timezoneCatalog.length === 0}
          >
            {timezoneCatalogLoading ? (
              <option value={timezone}>Loading timezones...</option>
            ) : (
              timezoneRegions.map((group) => (
                <optgroup key={group.region} label={group.region}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <FieldLabel>Language</FieldLabel>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={FIELD}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <FieldLabel>Date Format</FieldLabel>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className={FIELD}
          >
            {DATE_FORMAT_OPTIONS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <FieldLabel>Theme</FieldLabel>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className={FIELD}>
            {THEME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-6 space-y-3">
        <legend className="text-sm font-medium text-[#012352]">Notifications</legend>
        {[
          { id: "email_notifications", label: "Email notifications", checked: emailNotifications, set: setEmailNotifications },
          { id: "sms_notifications", label: "SMS notifications", checked: smsNotifications, set: setSmsNotifications },
          { id: "push_notifications", label: "Push notifications", checked: pushNotifications, set: setPushNotifications },
          { id: "marketing_emails", label: "Marketing emails", checked: marketingEmails, set: setMarketingEmails },
        ].map((item) => (
          <label key={item.id} className="flex items-center gap-3 text-sm text-[#374151]">
            <AccountCheckbox
              checked={item.checked}
              onChange={(e) => item.set(e.target.checked)}
            />
            {item.label}
          </label>
        ))}
      </fieldset>

      <div className="mt-6 flex justify-end">
        <AccountSaveButton saving={saving} />
      </div>
    </form>
  );
}
