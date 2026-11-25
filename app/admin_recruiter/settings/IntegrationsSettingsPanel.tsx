"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpen,
  Check,
  CircleHelp,
  Copy,
  KeyRound,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
  Webhook,
} from "lucide-react";
import IntegrationsApiDocs from "@/app/admin_recruiter/settings/IntegrationsApiDocs";
import { IntegrationBrandIcon } from "@/app/admin_recruiter/settings/integration-icons";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type IntegrationCategory =
  | "hr-payroll"
  | "communication"
  | "productivity"
  | "ai"
  | "automation";

type IntegrationTab = "all" | IntegrationCategory | "api-docs";

type IntegrationItem = {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  accent: string;
  initialConnected?: boolean;
  connectedOn?: string;
};

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  "hr-payroll": "HR & Payroll",
  communication: "Communication",
  productivity: "Productivity",
  ai: "AI",
  automation: "Automation",
};

const TABS: { id: IntegrationTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hr-payroll", label: "HR & Payroll" },
  { id: "communication", label: "Communication" },
  { id: "productivity", label: "Productivity" },
  { id: "ai", label: "AI" },
  { id: "automation", label: "Automation" },
  { id: "api-docs", label: "Brass HR API Documentation" },
];

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: "quickbooks",
    name: "Quickbooks",
    description: "Sync payroll, invoices, and accounting data with BrassHR.",
    category: "hr-payroll",
    accent: "#2CA01C",
    initialConnected: true,
    connectedOn: "Jan 12, 2026",
  },
  {
    id: "adp",
    name: "ADP",
    description: "Connect workforce and payroll records for hiring updates.",
    category: "hr-payroll",
    accent: "#D0271D",
  },
  {
    id: "gusto",
    name: "Gusto",
    description: "Automate onboarding and payroll for new hires.",
    category: "hr-payroll",
    accent: "#F45D48",
    initialConnected: true,
    connectedOn: "Feb 03, 2026",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Keep finance and staffing costs aligned in one place.",
    category: "hr-payroll",
    accent: "#13B5EA",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get hiring alerts and candidate updates in your channels.",
    category: "communication",
    accent: "#4A154B",
    initialConnected: true,
    connectedOn: "Mar 18, 2026",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Notify recruiters and managers inside Teams.",
    category: "communication",
    accent: "#5059C9",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Schedule interviews and sync availability automatically.",
    category: "productivity",
    accent: "#4285F4",
    initialConnected: true,
    connectedOn: "Jan 28, 2026",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Store offer letters and onboarding files securely.",
    category: "productivity",
    accent: "#0F9D58",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Let candidates book screening and interview slots.",
    category: "productivity",
    accent: "#006BFF",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Push hiring notes and checklists into Notion workspaces.",
    category: "productivity",
    accent: "#111111",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    description: "Draft job posts, outreach, and screening summaries.",
    category: "ai",
    accent: "#10A37F",
  },
  {
    id: "grok",
    name: "Grok",
    description: "Use AI assistance for recruiting research and insights.",
    category: "ai",
    accent: "#1A1A1A",
    initialConnected: true,
    connectedOn: "Apr 02, 2026",
  },
  {
    id: "webhook",
    name: "Webhook",
    description: "Send real-time BrassHR events to your own endpoints.",
    category: "automation",
    accent: "#012352",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Automate workflows across thousands of apps.",
    category: "automation",
    accent: "#FF4A00",
  },
  {
    id: "make",
    name: "Make",
    description: "Build visual automations for hiring operations.",
    category: "automation",
    accent: "#6D0FF2",
  },
  {
    id: "custom-api",
    name: "Custom API",
    description: "Use BrassHR inbound API keys for custom integrations.",
    category: "automation",
    accent: "#0EA5A4",
  },
];

const WEBHOOK_EVENTS = [
  { id: "new_application", label: "New application", defaultChecked: true },
  { id: "application_status_changed", label: "Application status changed", defaultChecked: true },
  { id: "new_hire", label: "New hire", defaultChecked: true },
  { id: "shift_update", label: "Shift update", defaultChecked: false },
  { id: "timesheet_approved", label: "Timesheet approved", defaultChecked: false },
  { id: "custom_event", label: "Custom event", defaultChecked: false },
] as const;

const inputClassName =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function IntegrationCard({
  item,
  connected,
  onConnect,
  onDisconnect,
}: {
  item: IntegrationItem;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-start gap-3">
        <IntegrationBrandIcon id={item.id} name={item.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[#0F172A]">{item.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748B]">{item.description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#F1F5F9] pt-3">
        {connected ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-[#047857]">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Connected
            </span>
            <div className="relative">
              <button
                type="button"
                aria-label={`${item.name} options`}
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC]"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-9 z-20 min-w-[140px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDisconnect();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-[#B91C1C] hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={item.id !== "custom-api"}
            title={item.id !== "custom-api" ? "Provider connection setup is not available yet." : undefined}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#012352] px-3 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC] min-[500px]:w-auto"
          >
            {item.id === "custom-api" ? "Manage API access" : "Not available yet"}
          </button>
        )}
      </div>
    </article>
  );
}

function ApiDocumentationTab() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/integrations/api-keys", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load API keys");
      setKeys((payload.keys ?? []) as ApiKeyRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function createKey() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a name for this API key");
      return;
    }
    setCreating(true);
    setRevealedKey(null);
    try {
      const response = await fetch("/api/admin/integrations/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not create API key");
      const apiKey = String(payload.key?.apiKey ?? "");
      setName("");
      setRevealedKey(apiKey || null);
      toast.success("API key created");
      await loadKeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create API key");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!window.confirm("Revoke this API key? Existing integrations using it will stop working.")) {
      return;
    }
    setRevokingId(keyId);
    try {
      const response = await fetch(`/api/admin/integrations/api-keys/${keyId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not revoke API key");
      toast.success("API key revoked");
      await loadKeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke API key");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }

  const activeKeys = keys.filter((key) => !key.revokedAt);
  const revokedKeys = keys.filter((key) => key.revokedAt);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-[#F3F4F6] p-2 text-[#012352]">
            <KeyRound className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Inbound API keys</h2>
            <p className="mt-1 text-xs leading-5 text-[#6B7280]">
              Keys authenticate{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">POST /api/v1/jobs</code>,{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">GET /api/v1/jobs/search</code>,{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">POST /api/v1/applicants/resume</code>, and{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">GET /api/v1/applicants/search</code>.
              Send the key as <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">Authorization: Bearer</code>{" "}
              or <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">X-API-Key</code>.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-xs text-[#374151]">
            Key name
            <input
              className={`${inputClassName} mt-1`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. iLabor production"
              maxLength={120}
              disabled={creating}
            />
          </label>
          <button
            type="button"
            onClick={() => void createKey()}
            disabled={creating || !name.trim()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#012352] px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {creating ? "Creating…" : "Create API key"}
          </button>
        </div>

        {revealedKey ? (
          <div className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
            <p className="text-xs font-medium text-[#92400E]">
              Copy this key now. It will not be shown again.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 text-xs text-[#111827]">
                {revealedKey}
              </code>
              <button
                type="button"
                onClick={() => void copyKey(revealedKey)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              >
                <Copy className="h-4 w-4" aria-hidden />
                Copy
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111827]">Active keys</h2>
        {loading ? (
          <p className="mt-3 text-xs text-[#6B7280]">Loading…</p>
        ) : activeKeys.length === 0 ? (
          <p className="mt-3 text-xs text-[#6B7280]">No active API keys yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#E5E7EB]">
            {activeKeys.map((key) => (
              <li
                key={key.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#111827]">{key.name}</p>
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    {key.keyPrefix}… · Created {formatDate(key.createdAt)} · Last used{" "}
                    {formatDate(key.lastUsedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revokeKey(key.id)}
                  disabled={revokingId === key.id}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#FECACA] px-3 text-sm text-[#B91C1C] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {revokingId === key.id ? "Revoking…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revokedKeys.length > 0 ? (
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#111827]">Revoked keys</h2>
          <ul className="mt-3 divide-y divide-[#E5E7EB]">
            {revokedKeys.map((key) => (
              <li key={key.id} className="py-3">
                <p className="text-sm text-[#6B7280]">{key.name}</p>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  {key.keyPrefix}… · Revoked {formatDate(key.revokedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <IntegrationsApiDocs />
    </div>
  );
}

export default function IntegrationsSettingsPanel() {
  const [activeTab, setActiveTab] = useState<IntegrationTab>("all");
  const [connectedIds, setConnectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("https://yourdomain.com/webhook/brasshr");
  const [webhookEvents, setWebhookEvents] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WEBHOOK_EVENTS.map((event) => [event.id, event.defaultChecked]))
  );

  const connectedItems = useMemo(
    () => INTEGRATIONS.filter((item) => connectedIds.has(item.id)),
    [connectedIds]
  );

  const visibleCategories = useMemo(() => {
    const categories = (
      Object.keys(CATEGORY_LABELS) as IntegrationCategory[]
    ).filter((category) => activeTab === "all" || activeTab === category);
    return categories.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: INTEGRATIONS.filter((item) => item.category === category),
    }));
  }, [activeTab]);

  function connectIntegration(id: string) {
    const name = INTEGRATIONS.find((item) => item.id === id)?.name || "This provider";
    toast.error(`${name} connection setup is not available yet.`);
  }

  function disconnectIntegration(id: string) {
    setConnectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    toast.success("Integration disconnected");
  }

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function saveWebhook() {
    toast.error("Webhook delivery is not configured. These settings have not been saved.");
  }

  return (
    <div className="w-full min-w-0">
      <div className="mb-5">
        <h1 className="text-lg font-semibold leading-6 tracking-tight text-[#012352]">
          Integrations
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Connect BrassHR with favorite tools to streamline your workflow.
        </p>
      </div>

      <div
        className="mb-6 flex flex-nowrap items-stretch gap-5 overflow-x-auto border-b border-[#E5E7EB] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Integration categories"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`relative shrink-0 pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? "text-[#012352]" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
              {active ? (
                <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-[#012352]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {activeTab === "api-docs" ? (
        <ApiDocumentationTab />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {visibleCategories.map(({ category, label, items }) => (
              <section key={category}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[#0F172A]">{label}</h2>
                  {activeTab === "all" ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(category)}
                      className="text-xs font-medium text-[#012352] hover:underline"
                    >
                      View All
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => (
                    <IntegrationCard
                      key={item.id}
                      item={item}
                      connected={connectedIds.has(item.id)}
                      onConnect={() => {
                        if (item.id === "custom-api") {
                          setActiveTab("api-docs");
                          return;
                        }
                        connectIntegration(item.id);
                      }}
                      onDisconnect={() => disconnectIntegration(item.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A]">Connected Integrations</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    {connectedItems.length} of {INTEGRATIONS.length} connected
                  </p>
                </div>
                <Link2 className="h-4 w-4 text-[#94A3B8]" aria-hidden />
              </div>
              {connectedItems.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No integrations connected yet.</p>
              ) : (
                <ul className="divide-y divide-[#F1F5F9]">
                  {connectedItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <IntegrationBrandIcon id={item.id} name={item.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#0F172A]">{item.name}</p>
                        <p className="text-[11px] text-[#64748B]">
                          {item.connectedOn ? `Connected on ${item.connectedOn}` : "Connected today"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#047857]">
                        Active
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#012352]">
                    <Webhook className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[#0F172A]">Webhook</h2>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Receive real-time notifications from BrassHR
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={webhookEnabled}
                  onClick={() => setWebhookEnabled((value) => !value)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    webhookEnabled ? "bg-[#012352]" : "bg-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      webhookEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <fieldset disabled={!webhookEnabled} className="space-y-4 disabled:opacity-60">
                <label className="block text-xs font-medium text-[#374151]">
                  Webhook URL
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      className={inputClassName}
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                      placeholder="https://yourdomain.com/webhook/brasshr"
                    />
                    <button
                      type="button"
                      onClick={() => void copyWebhookUrl()}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B] hover:bg-[#F8FAFC]"
                      aria-label="Copy webhook URL"
                    >
                      <Copy className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </label>

                <div>
                  <p className="text-xs font-medium text-[#374151]">Events to Send</p>
                  <ul className="mt-2 space-y-2">
                    {WEBHOOK_EVENTS.map((event) => (
                      <li key={event.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0F172A]">
                          <input
                            type="checkbox"
                            checked={Boolean(webhookEvents[event.id])}
                            onChange={(change) =>
                              setWebhookEvents((current) => ({
                                ...current,
                                [event.id]: change.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-[#CBD5E1] text-[#012352] focus:ring-[#012352]/30"
                          />
                          {event.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={saveWebhook}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#012352] px-4 text-sm font-medium text-white hover:brightness-95 min-[500px]:w-auto sm:self-end"
                >
                  Save Changes
                </button>
              </fieldset>
            </section>

            <section className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#012352] shadow-sm">
                  <CircleHelp className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A]">Need help?</h2>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Learn more about Integrations and how to set them up.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("api-docs")}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#012352] hover:underline"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                    Open API Documentation
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
