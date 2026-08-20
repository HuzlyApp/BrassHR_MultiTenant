export function countMultiJobApplicants<T>(
  items: T[],
  getAppliedJobCount: (item: T) => number
): number {
  return items.reduce((total, item) => total + (getAppliedJobCount(item) > 1 ? 1 : 0), 0);
}

export function countUniqueMultiJobApplicants<T>(
  items: T[],
  getAppliedJobCount: (item: T) => number,
  getUniqueKey: (item: T) => string
): number {
  const seen = new Set<string>();
  let total = 0;

  for (const item of items) {
    if (getAppliedJobCount(item) <= 1) continue;
    const key = getUniqueKey(item).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    total += 1;
  }

  return total;
}
