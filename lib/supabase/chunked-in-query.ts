const DEFAULT_CHUNK_SIZE = 80;

type ChunkQueryResult<T> = {
  data: T[];
  error: unknown | null;
};

/** Run Supabase `.in()` filters in chunks to avoid HTTP header overflow (16KB limit). */
export async function queryInChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<{ data: T[] | null; error: unknown | null }>,
  chunkSize = DEFAULT_CHUNK_SIZE
): Promise<ChunkQueryResult<T>> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return { data: [], error: null };

  const merged: T[] = [];
  for (let index = 0; index < unique.length; index += chunkSize) {
    const chunk = unique.slice(index, index + chunkSize);
    const { data, error } = await fetchChunk(chunk);
    if (error) return { data: merged, error };
    merged.push(...(data ?? []));
  }

  return { data: merged, error: null };
}
