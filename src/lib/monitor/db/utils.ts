

export const SCHEMA_ENSURE_TTL_MS = 5 * 60 * 1000;
// eslint-disable-next-line prefer-const
export let schemaEnsuredAt: number | null = null;
// eslint-disable-next-line prefer-const
export let schemaEnsurePromise: Promise<void> | null = null;

export const SOURCES_SYNC_TTL_MS = 30 * 1000;
// eslint-disable-next-line prefer-const
export let sourcesSyncedAt: number | null = null;
// eslint-disable-next-line prefer-const
export let sourcesSyncPromise: Promise<void> | null = null;

export const COUNT_CACHE_TTL_MS = 5 * 1000;
const countCache = new Map<string, { value: number; expiresAt: number }>();

export function getCountCacheKey(where: string, params: unknown[]): string {
  return `${where}:${JSON.stringify(params)}`;
}

export function getCachedCount(where: string, params: unknown[]): number | null {
  const key = getCountCacheKey(where, params);
  const entry = countCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }
  return null;
}

export function setCachedCount(where: string, params: unknown[], value: number): void {
  const key = getCountCacheKey(where, params);
  countCache.set(key, {
    value,
    expiresAt: Date.now() + COUNT_CACHE_TTL_MS,
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of countCache) {
    if (now >= entry.expiresAt) {
      countCache.delete(key);
    }
  }
}, 10 * 1000);