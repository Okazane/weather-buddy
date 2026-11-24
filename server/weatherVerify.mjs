import './coreLoader.mjs';

const consensusModule = await import('../src/core/weatherConsensus.ts');
const {
  DEFAULT_CONSENSUS_TIMEOUT_MS,
  fetchSecondaryWeatherSources,
  reconcileWeatherConsensus,
} = consensusModule;

export const DEFAULT_VERIFY_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_CACHE_ENTRIES = 250;

/**
 * Creates a 5-minute cached multi-source weather verification service
 * querying NOAA Aviation METAR ground stations & MET Norway ECMWF in parallel.
 */
export function createWeatherVerifier(options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    cacheTtlMs = DEFAULT_VERIFY_CACHE_TTL_MS,
    timeoutMs = DEFAULT_CONSENSUS_TIMEOUT_MS,
  } = options;

  const verifyCache = new Map();
  const inFlight = new Map();

  function pruneCache() {
    const now = Date.now();
    for (const [key, entry] of verifyCache.entries()) {
      if (entry.expiresAtMs <= now) {
        verifyCache.delete(key);
      }
    }
    while (verifyCache.size > MAX_VERIFY_CACHE_ENTRIES) {
      const oldestKey = verifyCache.keys().next().value;
      if (oldestKey === undefined) break;
      verifyCache.delete(oldestKey);
    }
  }

  async function verifyLocation(latitude, longitude, { force = false } = {}) {
    pruneCache();
    const cacheKey = `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}`;
    const now = Date.now();

    if (!force) {
      const cached = verifyCache.get(cacheKey);
      if (cached && cached.expiresAtMs > now) {
        // LRU promotion so frequently queried cities stay resident
        verifyCache.delete(cacheKey);
        verifyCache.set(cacheKey, cached);
        return {
          status: 'ok',
          latitude,
          longitude,
          metar: cached.observations.metar ?? null,
          metNorway: cached.observations.metNorway ?? null,
          fetchedAtIso: cached.observations.fetchedAtIso,
          expiresAtIso: new Date(cached.expiresAtMs).toISOString(),
          cacheHit: true,
        };
      }
    }

    const inflightKey = force ? `${cacheKey}:force` : cacheKey;
    let pending = inFlight.get(inflightKey);
    if (!pending) {
      pending = (async () => {
        const observations = await fetchSecondaryWeatherSources(latitude, longitude, {
          fetchImpl,
          timeoutMs,
          forceDirectUpstream: true,
        });
        const storedAt = Date.now();
        const entry = {
          observations,
          expiresAtMs: storedAt + cacheTtlMs,
        };
        verifyCache.delete(cacheKey);
        verifyCache.set(cacheKey, entry);
        return entry;
      })();
      inFlight.set(inflightKey, pending);
    }

    try {
      const entry = await pending;
      return {
        status: 'ok',
        latitude,
        longitude,
        metar: entry.observations.metar ?? null,
        metNorway: entry.observations.metNorway ?? null,
        fetchedAtIso: entry.observations.fetchedAtIso,
        expiresAtIso: new Date(entry.expiresAtMs).toISOString(),
        cacheHit: false,
      };
    } finally {
      if (inFlight.get(inflightKey) === pending) {
        inFlight.delete(inflightKey);
      }
    }
  }

  async function enrichSnapshot(snapshot, { force = false } = {}) {
    if (!snapshot || snapshot.provider === 'demo') {
      return snapshot;
    }
    try {
      const verified = await verifyLocation(snapshot.latitude, snapshot.longitude, { force });
      return reconcileWeatherConsensus(snapshot, {
        metar: verified.metar,
        metNorway: verified.metNorway,
        fetchedAtIso: verified.fetchedAtIso,
      });
    } catch {
      return reconcileWeatherConsensus(snapshot, { metar: null, metNorway: null });
    }
  }

  return {
    verifyLocation,
    enrichSnapshot,
    getCacheSize: () => {
      pruneCache();
      return verifyCache.size;
    },
  };
}
