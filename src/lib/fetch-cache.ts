type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type InflightEntry<T> = {
  promise: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, InflightEntry<unknown>>();
const DEFAULT_TTL = 60 * 1000;

export async function cachedFetch<T>(
  url: string,
  options: {
    signal?: AbortSignal;
    force?: boolean;
    ttl?: number;
    parseJson?: boolean;
  } = {},
): Promise<T> {
  if (typeof window === "undefined") {
    return null as T;
  }

  const { signal, force = false, ttl = DEFAULT_TTL, parseJson = true } = options;
  const cacheKey = url;
  const now = Date.now();

  if (!force) {
    const cached = cache.get(cacheKey);
    if (cached && now - cached.timestamp < ttl) {
      return cached.data as T;
    }
  }

  const existingInflight = inflight.get(cacheKey);
  if (existingInflight && !force) {
    try {
      const result = await existingInflight.promise;
      if (signal?.aborted) {
        const cached = cache.get(cacheKey);
        return cached ? (cached.data as T) : (result as T);
      }
      return result as T;
    } catch {
      const cached = cache.get(cacheKey);
      return cached ? (cached.data as T) : (null as T);
    }
  }

  const inflightEntry: InflightEntry<T> = {
    promise: (async () => {
      try {
        const res = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          signal: signal ?? AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
          const cached = cache.get(cacheKey);
          return cached ? (cached.data as T) : (null as T);
        }
        const data = parseJson ? await res.json() : ((await res.text()) as unknown as T);
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data as T;
      } catch (e) {
        const err = e as Error;
        console.debug("cachedFetch error:", url, err.message);
        const cached = cache.get(cacheKey);
        return cached ? (cached.data as T) : (null as T);
      }
    })(),
  };

  inflight.set(cacheKey, inflightEntry);

  try {
    const result = await inflightEntry.promise;
    if (signal?.aborted) {
      const cached = cache.get(cacheKey);
      return cached ? (cached.data as T) : result;
    }
    return result as T;
  } finally {
    inflight.delete(cacheKey);
  }
}

export function clearFetchCache(urlPrefix?: string) {
  if (!urlPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) {
      cache.delete(key);
    }
  }
}
