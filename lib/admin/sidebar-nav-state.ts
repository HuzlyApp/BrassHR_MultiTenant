/** Path match used by the staff sidebar, including the href clicked before the route commits. */
export function sidebarLinkIsActive(
  link: { href?: string | null; matchPrefixes: string[]; matchExact?: boolean },
  pathname: string,
  pendingHref: string | null
): boolean {
  if (pendingHref) return Boolean(link.href && pendingHref === link.href);
  return link.matchPrefixes.some((prefix) =>
    link.matchExact ? pathname === prefix || pathname === `${prefix}/` : pathname.startsWith(prefix)
  );
}
