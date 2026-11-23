/** Read the first amount (the minimum for a range) without merging range endpoints. */
export function parseWorkerRate(value: string | null | undefined): number | null {
  const amount = value?.match(/-?(?:\d[\d,]*(?:\.\d+)?|\.\d+)/)?.[0];
  if (!amount) return null;
  const parsed = Number(amount.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Missing rates stay last in either direction. */
export function compareWorkerRates(a: string | undefined, b: string | undefined, direction: "asc" | "desc"): number {
  const first = parseWorkerRate(a);
  const second = parseWorkerRate(b);
  if (first === null) return second === null ? 0 : 1;
  if (second === null) return -1;
  return (first - second) * (direction === "asc" ? 1 : -1);
}
