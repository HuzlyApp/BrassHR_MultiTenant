import { WORKER_SIDEBAR_SECTIONS } from "@/app/application/components/applicant-portal/worker-sidebar-config";

export type WorkerPortalSearchItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string[];
};

const EXTRA_SEARCH_ITEMS: WorkerPortalSearchItem[] = [
  {
    id: "tickets",
    label: "Support tickets",
    description: "View and track help requests",
    href: "/application/applicant-dashboard/tickets",
    keywords: ["ticket", "support", "help desk", "issue"],
  },
  {
    id: "overview",
    label: "Profile overview",
    description: "Account overview and completion",
    href: "/application/applicant-dashboard/profile",
    keywords: ["overview", "account", "profile home"],
  },
];

const SECTION_KEYWORDS: Record<string, string[]> = {
  Jobs: ["jobs", "openings", "apply", "career", "positions", "work type"],
  Schedule: ["calendar", "shifts", "appointments", "interview"],
  "Time Tracking": ["timesheet", "hours", "clock"],
  Locations: ["facility", "site", "office", "map"],
  Chat: ["messages", "group chat", "messaging"],
  "Personal Information": ["profile", "contact", "address", "phone", "email", "name"],
  Applications: ["applied", "application", "status", "pipeline"],
  Documents: ["files", "resume", "upload", "pdf", "attachments"],
  Certifications: ["licenses", "license", "cpr", "credentials", "skills"],
  "Help & Support": ["help", "support", "faq", "assistant"],
};

function flattenSidebarSearchItems(): WorkerPortalSearchItem[] {
  const items: WorkerPortalSearchItem[] = [];

  for (const section of WORKER_SIDEBAR_SECTIONS) {
    if (section.preventNavigation) continue;

    if (section.children?.length) {
      for (const child of section.children) {
        if (child.disabled || !child.href || child.href === "#") continue;
        items.push({
          id: `${section.label}:${child.label}`,
          label: child.label,
          description: section.label,
          href: child.href,
          keywords: [
            child.label.toLowerCase(),
            section.label.toLowerCase(),
            ...(SECTION_KEYWORDS[child.label] ?? []),
          ],
        });
      }
      continue;
    }

    if (section.disabled || !section.href || section.href === "#") continue;
    items.push({
      id: section.label,
      label: section.label,
      description: "Go to page",
      href: section.href,
      keywords: [section.label.toLowerCase(), ...(SECTION_KEYWORDS[section.label] ?? [])],
    });
  }

  return [...items, ...EXTRA_SEARCH_ITEMS];
}

const SEARCH_CATALOG = flattenSidebarSearchItems();

/** Default dropdown order when the search box is focused with an empty query. */
const FEATURED_SEARCH_IDS = [
  "My Schedule:Schedule",
  "My Schedule:Time Tracking",
  "Organization:Locations",
  "Jobs",
  "Chat",
  "Profile:Personal Information",
  "Profile:Documents",
  "Help & Support",
] as const;

function featuredSearchPages(limit: number): WorkerPortalSearchItem[] {
  const byId = new Map(SEARCH_CATALOG.map((item) => [item.id, item]));
  const featured = FEATURED_SEARCH_IDS.map((id) => byId.get(id)).filter(
    (item): item is WorkerPortalSearchItem => Boolean(item)
  );
  if (featured.length >= limit) return featured.slice(0, limit);

  const used = new Set(featured.map((item) => item.id));
  for (const item of SEARCH_CATALOG) {
    if (used.has(item.id)) continue;
    featured.push(item);
    used.add(item.id);
    if (featured.length >= limit) break;
  }
  return featured;
}

export function getWorkerPortalSearchCatalog(): WorkerPortalSearchItem[] {
  return SEARCH_CATALOG;
}

export function searchWorkerPortal(
  query: string,
  limit = 10
): { pages: WorkerPortalSearchItem[]; jobsShortcut: WorkerPortalSearchItem | null } {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { pages: featuredSearchPages(limit), jobsShortcut: null };
  }

  const scored = SEARCH_CATALOG.map((item) => {
    const haystack = `${item.label} ${item.description} ${item.keywords.join(" ")}`.toLowerCase();
    let score = 0;
    if (item.label.toLowerCase().startsWith(q)) score += 40;
    if (item.label.toLowerCase().includes(q)) score += 25;
    if (haystack.includes(q)) score += 10;
    for (const part of q.split(/\s+/).filter(Boolean)) {
      if (haystack.includes(part)) score += 5;
    }
    return { item, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));

  const pages = scored.slice(0, limit).map((entry) => entry.item);
  const jobsShortcut: WorkerPortalSearchItem = {
    id: `jobs-q:${q}`,
    label: `Search jobs for “${query.trim()}”`,
    description: "Open Jobs and filter openings",
    href: `/application/applicant-dashboard/jobs?q=${encodeURIComponent(query.trim())}`,
    keywords: [],
  };

  return { pages, jobsShortcut };
}
