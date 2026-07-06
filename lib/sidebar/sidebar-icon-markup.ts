import {
  getSidebarIconSrc,
  type SidebarIconType,
} from "@/app/admin_recruiter/components/sidebar-icons";
import { SIDEBAR_NAV_INACTIVE_HEX } from "@/lib/sidebar/sidebar-nav-styles";

const FIGMA_ICON_COLOR = /#BC8B41/gi;

const ALL_SIDEBAR_ICON_TYPES: SidebarIconType[] = [
  "Dashboard",
  "Mail",
  "Chat",
  "Schedule",
  "Tickets",
  "Reports",
  "Finance",
  "Taskboard",
  "Template Builder",
  "Teams",
  "Automation",
  "Connect",
  "Applicant",
  "Clients",
  "Organization",
  "My Profile",
  "Notifications",
  "Help & Support",
  "Settings",
  "Logout",
];

const svgTextCache = new Map<string, string>();
const tintedMarkupCache = new Map<string, string>();

function tintedCacheKey(src: string, primaryHex: string): string {
  return `${src}::${primaryHex}`;
}

async function loadSvgText(src: string): Promise<string> {
  const cached = svgTextCache.get(src);
  if (cached) return cached;

  const res = await fetch(src);
  if (!res.ok) return "";

  const text = await res.text();
  if (text) svgTextCache.set(src, text);
  return text;
}

function tintSvgMarkup(text: string, primaryHex: string): string {
  return text.replace(FIGMA_ICON_COLOR, primaryHex);
}

/** Read tinted sidebar icon markup from the in-memory cache (sync). */
export function getTintedSidebarIconMarkup(
  src: string,
  primaryHex: string
): string | null {
  return tintedMarkupCache.get(tintedCacheKey(src, primaryHex)) ?? null;
}

/** Fetch, tint, and cache sidebar icon markup. */
export async function ensureTintedSidebarIconMarkup(
  src: string,
  primaryHex: string
): Promise<string | null> {
  const key = tintedCacheKey(src, primaryHex);
  const cached = tintedMarkupCache.get(key);
  if (cached) return cached;

  const text = await loadSvgText(src);
  if (!text) return null;

  const markup = tintSvgMarkup(text, primaryHex);
  tintedMarkupCache.set(key, markup);
  return markup;
}

/** Warm the sidebar icon cache so menu icons render immediately. */
export async function prefetchSidebarIconMarkups(primaryHex: string): Promise<void> {
  const jobs: Promise<string | null>[] = [];
  for (const iconType of ALL_SIDEBAR_ICON_TYPES) {
    jobs.push(ensureTintedSidebarIconMarkup(getSidebarIconSrc(iconType, false), SIDEBAR_NAV_INACTIVE_HEX));
    jobs.push(ensureTintedSidebarIconMarkup(getSidebarIconSrc(iconType, true), primaryHex));
  }
  await Promise.all(jobs);
}
