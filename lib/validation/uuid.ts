const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

export function parseRequiredUuid(param: string | null | undefined, label: string) {
  const s = (param ?? "").trim();
  if (!s || !isUuid(s)) {
    return { ok: false as const, error: `Invalid ${label}` };
  }
  return { ok: true as const, value: s };
}
