"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { FIELD, FieldLabel } from "./account-form-fields";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSaveButton,
  AccountSuccessBanner,
} from "./AccountFormStatus";

const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
];

const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

const THEME_OPTIONS = ["system", "light", "dark"];

export default function AccountPreferencesPanel() {
  const { user, profile, organization, settings, checklist, loading, error, refresh } =
    useAccountData();

  const [timezone, setTimezone] = useState("America/New_York");
  const [language, setLanguage] = useState("en");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [theme, setTheme] = useState("system");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
      const { error: upsertError } = await supabaseBrowser.from("account_settings").upsert({
        user_id: user.id,
        timezone,
        language,
        date_format: dateFormat,
        theme,
        email_notifications: emailNotifications,
        sms_notifications: smsNotifications,
        push_notifications: pushNotifications,
        marketing_emails: marketingEmails,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      await refresh();
      await syncAccountChecklist(supabaseBrowser, {
        user,
        profile,
        organization,
        settings: {
          user_id: user.id,
          timezone,
          language,
          date_format: dateFormat,
          theme,
          email_notifications: emailNotifications,
          sms_notifications: smsNotifications,
          push_notifications: pushNotifications,
          marketing_emails: marketingEmails,
          created_at: settings?.created_at ?? null,
          updated_at: new Date().toISOString(),
        },
        checklist,
      });
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
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Timezone</FieldLabel>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={FIELD}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
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
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => item.set(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5DB]"
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
