const ICON_SRC: Record<string, string> = {
  quickbooks: "/icons/integrations/quickbooks.svg",
  adp: "/icons/integrations/adp.svg",
  gusto: "/icons/integrations/gusto.svg",
  xero: "/icons/integrations/xero.svg",
  slack: "/icons/integrations/slack.svg",
  teams: "/icons/integrations/teams.svg",
  "google-calendar": "/icons/integrations/google-calendar.svg",
  "google-drive": "/icons/integrations/google-drive.svg",
  calendly: "/icons/integrations/calendly.svg",
  notion: "/icons/integrations/notion.svg",
  grok: "/icons/integrations/grok.svg",
  webhook: "/icons/integrations/webhook.svg",
  zapier: "/icons/integrations/zapier.svg",
  make: "/icons/integrations/make.svg",
  "custom-api": "/icons/integrations/custom-api.svg",
};

export function IntegrationBrandIcon({ id, name }: { id: string; name: string }) {
  const src = ICON_SRC[id];

  if (!src) {
    return (
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#012352]"
        title={name}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EB] bg-white"
      title={name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-7 w-7 object-contain" aria-hidden />
    </span>
  );
}
