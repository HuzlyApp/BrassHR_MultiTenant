/**
 * PostgREST caps `.range()` responses (typically 1,000 rows).
 * Fetch the first page, then later pages in small parallel batches.
 * A short page ends the scan. Later pages in that batch are discarded.
 */
export async function loadPagedRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  options?: { pageSize?: number; maxPages?: number; batchSize?: number }
): Promise<T[]> {
  const pageSize = options?.pageSize ?? 1000;
  const maxPages = options?.maxPages ?? 20;
  const batchSize = options?.batchSize ?? 4;
  if (pageSize < 1 || maxPages < 1) return [];

  const first = await fetchPage(0, pageSize - 1);
  const rows = [...first];
  if (first.length < pageSize || maxPages === 1) return rows;

  let pages = 1;
  let from = pageSize;
  while (pages < maxPages) {
    const room = maxPages - pages;
    const count = Math.min(batchSize, room);
    const starts = Array.from({ length: count }, (_, index) => from + index * pageSize);
    const batch = await Promise.all(
      starts.map((start) => fetchPage(start, start + pageSize - 1))
    );
    let stop = false;
    for (const page of batch) {
      pages += 1;
      rows.push(...page);
      if (page.length < pageSize) {
        stop = true;
        break;
      }
    }
    if (stop) break;
    from += count * pageSize;
  }
  return rows;
}
