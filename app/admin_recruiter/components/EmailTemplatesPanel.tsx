"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { interpolateTemplate } from "@/lib/email-templates/interpolation";
import { sanitizeEmailHtml } from "@/lib/email-templates/sanitize-html";
import { Mail } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { EMAIL_TEMPLATE_TYPE_LABELS } from "@/lib/email-templates/template-keys";
import type { AdminEmailTemplateItem } from "@/lib/email-templates/types";

type LoadResponse = {
  tenantName?: string | null;
  resendFromDomain?: string | null;
  templates?: AdminEmailTemplateItem[];
  error?: string;
  code?: string;
  detail?: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function InfoBanner({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}

export default function EmailTemplatesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantMissing, setTenantMissing] = useState(false);
  const [templates, setTemplates] = useState<AdminEmailTemplateItem[]>([]);
  const [selectedKey, setSelectedKey] = useState("welcome");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [fromEmailLocalPart, setFromEmailLocalPart] = useState("notifications");
  const [resendFromDomain, setResendFromDomain] = useState("brasshr.com");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const activeField = useRef<"subject" | "html" | "text">("html");

  const selected = useMemo(
    () => templates.find((t) => t.template_key === selectedKey) ?? null,
    [templates, selectedKey]
  );

  const previewVariables = Object.fromEntries(
    (selected?.variables ?? []).map((variable) => {
      const key = variable.key;
      const sample = variable.sample?.trim() || "";
      const sampleFallback = /email/i.test(key) ? "support@example.com" : /name/i.test(key) ? "Alex Morgan" : `Sample ${key}`;
      const tenantFallback =
        key === "tenantName" || key === "companyName" || key === "organizationName"
          ? tenantName?.trim() || ""
          : "";
      const resolved =
        tenantFallback && (!sample || sample === `[${key}]`)
          ? tenantFallback
          : sample && sample !== `[${key}]` ? sample : tenantFallback || sampleFallback;
      return [key, resolved];
    })
  );
  function insertVariable(key: string) {
    const field = activeField.current;
    const input = field === "subject" ? subjectRef.current : field === "text" ? textRef.current : htmlRef.current;
    const value = field === "subject" ? subject : field === "text" ? bodyText : bodyHtml;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? start;
    const token = `{{${key}}}`;
    const next = value.slice(0, start) + token + value.slice(end);
    if (field === "subject") setSubject(next); else if (field === "text") setBodyText(next); else setBodyHtml(next);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length, start + token.length); });
  }

  const applySelection = useCallback((item: AdminEmailTemplateItem) => {
    setSubject(item.subject);
    setBodyHtml(item.body_html);
    setBodyText(item.body_text ?? "");
    setFromEmailLocalPart(item.from_email_local_part || "notifications");
    setReplyToEmail(item.reply_to_email ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setTenantMissing(false);
    try {
      const res = await fetch("/api/admin/email-templates", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (payload.code === "TENANT_REQUIRED") {
          setTenantMissing(true);
          setTemplates([]);
          return;
        }
        throw new Error(payload.detail ?? payload.error ?? "Could not load email templates");
      }
      setTenantName(payload.tenantName ?? null);
      if (payload.resendFromDomain) setResendFromDomain(payload.resendFromDomain);
      const list = payload.templates ?? [];
      setTemplates(list);
      const first = list[0];
      if (first) {
        setSelectedKey(first.template_key);
        applySelection(first);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [applySelection]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    if (selected) applySelection(selected);
  }, [selectedKey, selected, applySelection]);

  const save = async () => {
    if (!selectedKey) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!subject.trim()) throw new Error("Subject is required.");
      if (!bodyHtml.trim()) throw new Error("Email body is required.");

      const res = await fetch("/api/admin/email-templates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          template_key: selectedKey,
          locale: "en",
          subject: subject.trim(),
          body_html: bodyHtml.trim(),
          body_text: bodyText.trim() || null,
          from_email_local_part: fromEmailLocalPart.trim() || "notifications",
          reply_to_email: replyToEmail.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        detail?: string;
        template?: AdminEmailTemplateItem;
      };
      if (!res.ok) {
        throw new Error(payload.detail ?? payload.error ?? "Save failed");
      }
      if (payload.template) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.template_key === payload.template!.template_key ? payload.template! : t
          )
        );
      }
      setMessage("Email template saved for this tenant.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return null;
  }

  if (tenantMissing) {
    return (
      <InfoBanner
        title="Select a tenant"
        body="Use the tenant switcher in the header to choose which organization's email templates you want to edit."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[#0F172A]">
          <Mail className="h-5 w-5 text-[color:var(--brand-primary)]" aria-hidden />
          <div>
            <p className="text-sm font-medium text-[#64748B]">Tenant</p>
            <p className="text-base font-semibold">{tenantName ?? "Current tenant"}</p>
          </div>
        </div>
        {selected ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selected.is_tenant_override
                ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] text-[color:var(--brand-primary)]"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {selected.is_tenant_override
              ? "Tenant custom template"
              : "Using platform default (save to customize)"}
          </span>
        ) : null}
      </div>

      {error && !templates.length ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)]">
        <div className="space-y-1">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Templates
          </p>
          {templates.map((t) => {
            const active = t.template_key === selectedKey;
            return (
              <button
                key={t.template_key}
                type="button"
                onClick={() => setSelectedKey(t.template_key)}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition ${
                  active
                    ? "border border-[color:var(--brand-primary)] bg-white text-[color:var(--brand-primary)] shadow-sm"
                    : "text-[#3e5d5a] hover:bg-white/80"
                }`}
              >
                <span className="font-medium">
                  {EMAIL_TEMPLATE_TYPE_LABELS[
                    t.template_key as keyof typeof EMAIL_TEMPLATE_TYPE_LABELS
                  ] ?? t.template_key}
                </span>
                {t.is_tenant_override ? (
                  <span className="mt-0.5 text-xs text-[color:var(--brand-primary)]">Customized</span>
                ) : (
                  <span className="mt-0.5 text-xs text-slate-500">Default</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          {selected?.variables.length ? (
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-[#64748B]">
              <p className="w-full">Insert a placeholder into the last focused subject or body field:</p>
              {selected.variables.map(variable => <button key={variable.key} type="button" onClick={() => insertVariable(variable.key)} title={variable.description} className="rounded border border-slate-300 px-2 py-1 text-slate-700">{`{{${variable.key}}}`}</button>)}
            </div>
          ) : null}

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-[#0F172A]">From email</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fromEmailLocalPart}
                  onChange={(e) => setFromEmailLocalPart(e.target.value)}
                  placeholder="notifications"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 font-mono text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
                  aria-label="From email local part"
                />
                <span className="shrink-0 text-sm font-medium text-[#64748B]">
                  @{resendFromDomain}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Only the part before @ is saved. Domain is set by{" "}
                <code className="rounded bg-slate-100 px-1">RESEND_FROM_DOMAIN</code>.
              </p>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#0F172A]">Reply-to email</span>
              <input
                type="email"
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
                placeholder="support@yourdomain.com"
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
              />
            </label>
          </div>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-[#0F172A]">Subject</span>
            <input
              type="text"
              value={subject}
              ref={subjectRef}
              onFocus={() => { activeField.current = "subject"; }}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-[#0F172A]">
              Email body (HTML)
            </span>
            <textarea
              value={bodyHtml}
              ref={htmlRef}
              onFocus={() => { activeField.current = "html"; }}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={12}
              className="w-full resize-y rounded-lg border border-[#e2e8f0] px-3 py-2 font-mono text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
              placeholder="<p>Hello {{first_name}},</p>"
            />
          </label>

          <label className="mb-6 block">
            <span className="mb-1 block text-sm font-medium text-[#0F172A]">
              Plain text (optional)
            </span>
            <textarea
              value={bodyText}
              ref={textRef}
              onFocus={() => { activeField.current = "text"; }}
              onChange={(e) => setBodyText(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
              placeholder="Hello {{first_name}},"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setPreviewOpen(value => !value)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold">{previewOpen ? "Hide preview" : "Preview email"}</button>
            <button type="button" disabled={saving || !selected?.defaults} onClick={() => {
              if (!selected?.defaults || !window.confirm("Replace this draft with the platform default? Save template to apply the change.")) return;
              setSubject(selected.defaults.subject);
              setBodyHtml(selected.defaults.body_html);
              setBodyText(selected.defaults.body_text ?? "");
              setMessage("Default content restored in this draft. Save template to apply it.");
            }} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">Reset to default</button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-xl bg-[color:var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save template"}
            </button>
            {message ? <span className="text-sm text-green-700">{message}</span> : null}
            {error ? <span className="text-sm text-red-700">{error}</span> : null}
          </div>
          {previewOpen ? <section aria-label="Email preview" className="mt-5 space-y-3 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold">{interpolateTemplate(subject, previewVariables, { escapeForHtml: false })}</h3>
            <p className="text-xs text-slate-500">Preview uses sample placeholder values.</p>
            <iframe title="Email body preview" sandbox="" className="h-80 w-full rounded border border-slate-200" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'">${sanitizeEmailHtml(interpolateTemplate(bodyHtml, previewVariables))}`} />
          </section> : null}
        </div>
      </div>
    </div>
  );
}
