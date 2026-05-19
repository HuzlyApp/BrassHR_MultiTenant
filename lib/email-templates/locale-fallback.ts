export function buildLocaleFallbackChain(locale: string, defaultLocale = "en"): string[] {
  const normalized = locale.trim().replace(/_/g, "-");
  const chain: string[] = [];
  if (normalized) chain.push(normalized);
  const dash = normalized.indexOf("-");
  if (dash > 0) {
    const base = normalized.slice(0, dash).toLowerCase();
    if (base && !chain.includes(base)) chain.push(base);
  }
  const def = defaultLocale.trim().toLowerCase();
  if (def && !chain.includes(def)) chain.push(def);
  return chain;
}
