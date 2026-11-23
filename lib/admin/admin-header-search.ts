import {
  CLIENT_SIDEBAR_SECTIONS,
  type SidebarLink,
  type SidebarSection,
} from "@/app/admin_recruiter/components/sidebar-config";
import { candidatesListPath, emptyCandidatesListUrlState } from "@/lib/workers/candidates-list-url";

export type AdminHeaderSearchItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  kind: "page" | "person" | "job" | "shortcut";
};

const SECTION_KEYWORDS: Record<string, string[]> = {
  "Launch Pad": ["launch", "onboarding", "setup", "goals"],
  Dashboard: ["home", "overview", "metrics"],
  Hiring: ["recruiting", "pipeline", "applicants"],
  Candidates: ["applicants", "talent", "people search"],
  Applicants: ["candidates", "applications", "pipeline"],
  Jobs: ["requisitions", "postings", "openings", "roles"],
  People: ["workforce", "employees", "staff"],
  Workers: ["employees", "active workers", "workforce"],
  Clients: ["organizations", "accounts", "customers"],
  Facilities: ["locations", "sites", "buildings"],
  Schedule: ["calendar", "shifts", "who is off"],
  Time: ["attendance", "timesheets", "clock"],
  Reports: ["analytics", "productivity"],
  Mail: ["email", "inbox"],
  Chat: ["messages", "messaging"],
  Settings: ["configuration", "admin", "company"],
  "Help & Support": ["faq", "help desk", "support"],
};

function pushLink(
  items: AdminHeaderSearchItem[],
  link: SidebarLink,
  parentLabel: string,
  seen: Set<string>
) {
  if (link.disabled) return;
  if (link.children?.length) {
    for (const child of link.children) {
      pushLink(items, child, link.label, seen);
    }
    return;
  }
  const href = link.href?.trim() ?? "";
  if (!href || href === "#") return;
  const id = `page:${href}`;
  if (seen.has(id)) return;
  seen.add(id);
  items.push({
    id,
    label: link.label,
    description: parentLabel,
    href,
    kind: "page",
  });
}

function flattenSections(sections: SidebarSection[]): AdminHeaderSearchItem[] {
  const items: AdminHeaderSearchItem[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    if (section.children?.length) {
      for (const child of section.children) {
        pushLink(items, child, section.label, seen);
      }
      continue;
    }
    const href = section.href?.trim() ?? "";
    if (!href || href === "#" || section.disabled) continue;
    const id = `page:${href}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      label: section.label,
      description: "Go to page",
      href,
      kind: "page",
    });
  }
  return items;
}

const PAGE_CATALOG = flattenSections(CLIENT_SIDEBAR_SECTIONS);

const FEATURED_HREFS = [
  "/admin_recruiter/home",
  "/admin_recruiter/candidates",
  "/admin_recruiter/jobs",
  "/admin_recruiter/workers",
  "/admin_recruiter/messages",
  "/admin_recruiter/calendar/shifts",
  "/admin_recruiter/clients",
  "/admin_recruiter/help-support",
] as const;

function featuredPages(limit: number): AdminHeaderSearchItem[] {
  const byHref = new Map(PAGE_CATALOG.map((item) => [item.href, item]));
  const featured = FEATURED_HREFS.map((href) => byHref.get(href)).filter(
    (item): item is AdminHeaderSearchItem => Boolean(item)
  );
  if (featured.length >= limit) return featured.slice(0, limit);
  const used = new Set(featured.map((item) => item.id));
  for (const item of PAGE_CATALOG) {
    if (used.has(item.id)) continue;
    featured.push(item);
    used.add(item.id);
    if (featured.length >= limit) break;
  }
  return featured;
}

function pageHaystack(item: AdminHeaderSearchItem): string {
  const keywords = SECTION_KEYWORDS[item.label] ?? SECTION_KEYWORDS[item.description] ?? [];
  return `${item.label} ${item.description} ${keywords.join(" ")} ${item.href}`.toLowerCase();
}

export function getAdminHeaderSearchCatalog(): AdminHeaderSearchItem[] {
  return PAGE_CATALOG;
}

export function searchAdminHeaderPages(query: string, limit = 8): AdminHeaderSearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return featuredPages(limit);

  return PAGE_CATALOG.map((item) => {
    const haystack = pageHaystack(item);
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
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function adminHeaderSearchShortcuts(query: string): AdminHeaderSearchItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const encoded = encodeURIComponent(trimmed);
  return [
    {
      id: `shortcut:candidates:${trimmed.toLowerCase()}`,
      label: `Search candidates for “${trimmed}”`,
      description: "Open Candidates with this query",
      href: candidatesListPath({ ...emptyCandidatesListUrlState(), q: trimmed }),
      kind: "shortcut",
    },
    {
      id: `shortcut:jobs:${trimmed.toLowerCase()}`,
      label: `Search jobs for “${trimmed}”`,
      description: "Open Jobs with this query",
      href: `/admin_recruiter/jobs?q=${encoded}`,
      kind: "shortcut",
    },
    {
      id: `shortcut:workers:${trimmed.toLowerCase()}`,
      label: `Search workers for “${trimmed}”`,
      description: "Open Workers list",
      href: `/admin_recruiter/workers`,
      kind: "shortcut",
    },
  ];
}

export function candidatesResultsHref(query: string): string {
  return candidatesListPath({ ...emptyCandidatesListUrlState(), q: query.trim() });
}
