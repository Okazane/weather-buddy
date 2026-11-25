import { spawn as nodeSpawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

import { computeAnalytics24h } from './analytics.mjs';
import {
  AUTO_REFRESH_INTERVAL_MINUTES,
  AUTO_REFRESH_INTERVAL_MS,
  PRESET_CITIES,
  evaluateCharacterDecision,
  fetchWeatherSnapshot,
} from './coreLoader.mjs';
import {
  createAutoLocator,
  createPlaceSearcher,
  createReverseGeocoder,
} from './reverseGeocode.mjs';
import { createWeatherVerifier } from './weatherVerify.mjs';
import {
  RuntimeStore,
  buildTelemetryEntry,
  hashApiKeys,
  redactSecrets,
} from './runtimeStore.mjs';
import {
  DEFAULT_RATE_LIMITS,
  HTML_CONTENT_SECURITY_POLICY,
  MAX_REQUEST_BODY_BYTES,
  UPSTREAM_FETCH_TIMEOUT_MS,
  SlidingWindowRateLimiter,
  applyHardenedHeaders,
  createTimeoutFetch,
  isStrictLoopback,
  isSuspiciousStaticPath,
  verifyCsrfHeader,
  verifyTrustedOriginForMutation,
} from './security.mjs';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');
const DEFAULT_RUNTIME_DIR = path.join(SERVER_DIR, '.runtime');
const DEFAULT_DIST_DIR = path.join(PROJECT_ROOT, 'dist');

export const SERVER_VERSION = '3.0.0';
export const DEFAULT_PORT = Number(process.env.PORT) || 8787;

const MAX_WEATHER_CACHE_ENTRIES = 250;

const ALLOWED_PROVIDERS = new Set([
  'auto',
  'tomorrow_io',
  'weatherapi',
  'google',
  'open_meteo',
]);

const ALLOWED_WIDGET_CORNERS = new Set([
  'BottomRight',
  'TopRight',
  'BottomLeft',
  'TopLeft',
]);

const ALLOWED_WIDGET_SIZES = new Set(['Compact', 'Standard']);
const ALLOWED_GENDERS = new Set(['male', 'female']);

const PC_SUITE_DOWNLOADS = [
  '/downloads/weather-buddy-extension.zip',
  '/downloads/weather-buddy-desktop-widget.zip',
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
};

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.webmanifest',
  '.map',
  '.svg',
  '.txt',
]);

const brotliCompressAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);

function negotiateCompression(acceptEncoding) {
  const raw = String(acceptEncoding || '').toLowerCase();
  if (!raw) return null;
  if (/\bbr\b/.test(raw)) return 'br';
  if (/\bgzip\b/.test(raw)) return 'gzip';
  return null;
}

function sendJson(res, statusCode, payload) {
  const bodyBuf = Buffer.from(`${JSON.stringify(payload)}\n`, 'utf8');
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Vary', 'Accept-Encoding');

  const encoding =
    bodyBuf.byteLength >= 1024 ? negotiateCompression(res._acceptEncoding) : null;

  if (encoding === 'br') {
    const compressed = zlib.brotliCompressSync(bodyBuf, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Content-Length', compressed.byteLength);
    res.end(compressed);
    return;
  }

  if (encoding === 'gzip') {
    const compressed = zlib.gzipSync(bodyBuf, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', compressed.byteLength);
    res.end(compressed);
    return;
  }

  res.setHeader('Content-Length', bodyBuf.byteLength);
  res.end(bodyBuf);
}

async function readJsonBody(req, maxBytes = MAX_REQUEST_BODY_BYTES) {
  const declaredLen = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    req.resume();
    const err = new Error('Kích thước yêu cầu vượt quá giới hạn tối đa 16KB (413 Payload Too Large).');
    err.statusCode = 413;
    throw err;
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const err = new Error('Kích thước yêu cầu vượt quá giới hạn tối đa 16KB (413 Payload Too Large).');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  if (totalBytes === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const err = new Error('Body yêu cầu phải là một JSON object hợp lệ.');
      err.statusCode = 400;
      throw err;
    }
    return parsed;
  } catch (err) {
    if (err.statusCode) throw err;
    const parseErr = new Error('Định dạng JSON không hợp lệ.');
    parseErr.statusCode = 400;
    throw parseErr;
  }
}

function readHeaderString(headers, name) {
  const val = headers[name.toLowerCase()];
  if (Array.isArray(val)) {
    return String(val[0] || '').trim();
  }
  return typeof val === 'string' ? val.trim() : '';
}

const KNOWN_VIETNAM_CITIES = [
  ...PRESET_CITIES,
  { nameVi: 'Hải Phòng', latitude: 20.8449, longitude: 106.6881 },
  { nameVi: 'Huế', latitude: 16.4637, longitude: 107.5909 },
  { nameVi: 'Nha Trang', latitude: 12.2388, longitude: 109.1967 },
  { nameVi: 'Vũng Tàu', latitude: 10.3460, longitude: 107.0843 },
  { nameVi: 'Quy Nhơn', latitude: 13.7830, longitude: 109.2197 },
  { nameVi: 'Buôn Ma Thuột', latitude: 12.6667, longitude: 108.0500 },
  { nameVi: 'Vinh', latitude: 18.6796, longitude: 105.6813 },
  { nameVi: 'Phú Quốc', latitude: 10.2270, longitude: 103.9632 },
  { nameVi: 'Pleiku', latitude: 13.9833, longitude: 108.0000 },
  { nameVi: 'Phan Thiết', latitude: 10.9289, longitude: 108.1021 },
  { nameVi: 'Hạ Long', latitude: 20.9511, longitude: 107.0748 },
  { nameVi: 'Biên Hòa', latitude: 10.9574, longitude: 106.8427 },
  { nameVi: 'Thủ Dầu Một', latitude: 10.9804, longitude: 106.6519 },
  { nameVi: 'Thanh Hóa', latitude: 19.8067, longitude: 105.7852 },
  { nameVi: 'Đồng Hới', latitude: 17.4689, longitude: 106.6223 },
  { nameVi: 'Tuy Hòa', latitude: 13.0955, longitude: 109.3209 },
  { nameVi: 'Rạch Giá', latitude: 10.0125, longitude: 105.0809 },
  { nameVi: 'Côn Đảo', latitude: 8.6833, longitude: 106.6094 },
];

function inferCityName(lat, lon, explicitName) {
  if (typeof explicitName === 'string' && explicitName.trim()) {
    return explicitName.trim().slice(0, 120);
  }
  for (const preset of KNOWN_VIETNAM_CITIES) {
    if (
      Math.abs(lat - preset.latitude) <= 0.08 &&
      Math.abs(lon - preset.longitude) <= 0.08
    ) {
      return preset.nameVi;
    }
  }
  return 'Vị trí hiện tại';
}

function parseCoordinates(rawLat, rawLon, defaultCity = PRESET_CITIES[0]) {
  const hasLat = rawLat !== undefined && rawLat !== null && String(rawLat).trim() !== '';
  const hasLon = rawLon !== undefined && rawLon !== null && String(rawLon).trim() !== '';

  if (!hasLat && !hasLon && defaultCity) {
    return {
      latitude: defaultCity.latitude,
      longitude: defaultCity.longitude,
      usedDefault: true,
    };
  }

  const latitude = Number(rawLat);
  const longitude = Number(rawLon);

  if (
    !hasLat ||
    !hasLon ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    const err = new Error(
      'Tọa độ lat/lon không hợp lệ (lat trong [-90, 90], lon trong [-180, 180]).'
    );
    err.statusCode = 400;
    throw err;
  }

  return {
    latitude: Number(latitude.toFixed(5)),
    longitude: Number(longitude.toFixed(5)),
    usedDefault: false,
  };
}

function parseForceFlag(val) {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const normalized = val.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}

function parseGender(val) {
  return val === 'male' ? 'male' : 'female';
}

function parseSensitivity(val) {
  if (val === 'cold_sensitive' || val === 'heat_sensitive') {
    return val;
  }
  return 'normal';
}

/**
 * Creates the Full-Stack WeatherBuddy HTTP API + Static Web Dashboard Server.
 * Hardened with CSP, strict CORS allowlist, CSRF guard, sliding-window IP rate limiting,
 * 16KB body cap, 10s upstream AbortSignal timeout, salted SHA-256 key isolation, and secret redaction.
 */
export function createWeatherBuddyServer(options = {}) {
  const {
    projectRoot = PROJECT_ROOT,
    runtimeDir = DEFAULT_RUNTIME_DIR,
    distDir = DEFAULT_DIST_DIR,
    fetchImpl: rawFetchImpl = globalThis.fetch,
    spawnImpl = nodeSpawn,
    cacheTtlMs = AUTO_REFRESH_INTERVAL_MS,
    staleGraceMs = 45 * 60 * 1000,
    upstreamTimeoutMs = UPSTREAM_FETCH_TIMEOUT_MS,
    maxBodyBytes = MAX_REQUEST_BODY_BYTES,
    rateLimits = DEFAULT_RATE_LIMITS,
    enableConsensus = true,
    localKeysFile = null,
  } = options;

  let cachedLocalKeys = { tomorrowIoApiKey: '', weatherApiKey: '', googleApiKey: '' };
  if (localKeysFile) {
    try {
      const rawLocal = fs.readFileSync(localKeysFile, 'utf8');
      const parsedLocal = JSON.parse(rawLocal);
      cachedLocalKeys = {
        tomorrowIoApiKey:
          typeof parsedLocal?.tomorrowIoApiKey === 'string'
            ? parsedLocal.tomorrowIoApiKey.trim()
            : '',
        weatherApiKey:
          typeof parsedLocal?.weatherApiKey === 'string'
            ? parsedLocal.weatherApiKey.trim()
            : '',
        googleApiKey:
          typeof parsedLocal?.googleApiKey === 'string'
            ? parsedLocal.googleApiKey.trim()
            : '',
      };
    } catch {
      // Optional local runtime key file not present
    }
  }

  const publicDir = path.join(projectRoot, 'public');
  const startedAtMs = Date.now();
  const timedFetch = createTimeoutFetch(rawFetchImpl, upstreamTimeoutMs);
  const runtimeStore = new RuntimeStore(runtimeDir);
  const reverseGeocode = createReverseGeocoder({ fetchImpl: timedFetch });
  const autoLocate = createAutoLocator({ fetchImpl: timedFetch, reverseGeocode });
  const searchPlaces = createPlaceSearcher({ fetchImpl: timedFetch });
  const weatherVerifier = createWeatherVerifier({ fetchImpl: timedFetch });
  const rateLimiter = new SlidingWindowRateLimiter(rateLimits);

  // 15-minute smart weather cache + 45-minute Stale-While-Revalidate (SWR) warm fallback
  const weatherCache = new Map();
  const staleWeatherCache = new Map();
  const inFlightWeather = new Map();
  const compressedAssetCache = new Map();
  const MAX_COMPRESSED_ASSET_CACHE = 48;

  let totalRequests = 0;
  let cacheHits = 0;

  function pruneWeatherCache() {
    const now = Date.now();
    for (const [k, entry] of weatherCache.entries()) {
      if (entry.expiresAtMs <= now) {
        weatherCache.delete(k);
      }
    }
    while (weatherCache.size > MAX_WEATHER_CACHE_ENTRIES) {
      const oldestKey = weatherCache.keys().next().value;
      if (oldestKey === undefined) break;
      weatherCache.delete(oldestKey);
    }
    for (const [k, entry] of staleWeatherCache.entries()) {
      if (entry.staleUntilMs <= now) {
        staleWeatherCache.delete(k);
      }
    }
    while (staleWeatherCache.size > MAX_WEATHER_CACHE_ENTRIES) {
      const oldestKey = staleWeatherCache.keys().next().value;
      if (oldestKey === undefined) break;
      staleWeatherCache.delete(oldestKey);
    }
  }

  function buildServerHealth() {
    pruneWeatherCache();
    const uptimeSec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    const cacheHitRatePct =
      totalRequests > 0
        ? Math.round((cacheHits / totalRequests) * 1000) / 10
        : 0;

    return {
      status: 'ok',
      service: 'weather-buddy-backend',
      version: SERVER_VERSION,
      uptimeSec,
      refreshIntervalMinutes: AUTO_REFRESH_INTERVAL_MINUTES,
      cacheSize: weatherCache.size,
      totalRequests,
      cacheHits,
      cacheHitRatePct,
    };
  }

  function extractRequestApiKeys(req, body = {}) {
    // Server default API keys are strictly blank ("") unless local runtime keys file is explicitly provided in CLI mode
    const tomorrowIoApiKey =
      readHeaderString(req.headers, 'x-tomorrow-api-key') ||
      (typeof body.tomorrowIoApiKey === 'string' ? body.tomorrowIoApiKey.trim() : '') ||
      (typeof body.tomorrowApiKey === 'string' ? body.tomorrowApiKey.trim() : '') ||
      cachedLocalKeys.tomorrowIoApiKey ||
      '';

    const weatherApiKey =
      readHeaderString(req.headers, 'x-weatherapi-key') ||
      (typeof body.weatherApiKey === 'string' ? body.weatherApiKey.trim() : '') ||
      cachedLocalKeys.weatherApiKey ||
      '';

    const googleApiKey =
      readHeaderString(req.headers, 'x-google-api-key') ||
      (typeof body.googleApiKey === 'string' ? body.googleApiKey.trim() : '') ||
      cachedLocalKeys.googleApiKey ||
      '';

    return {
      tomorrowIoApiKey,
      weatherApiKey,
      googleApiKey,
    };
  }

  async function getOrFetchWeather({
    latitude,
    longitude,
    locationName,
    hasExplicitName = false,
    provider = 'auto',
    force = false,
    gender = 'female',
    sensitivity = 'normal',
    tomorrowIoApiKey = '',
    weatherApiKey = '',
    googleApiKey = '',
  }) {
    if (!ALLOWED_PROVIDERS.has(provider)) {
      const err = new Error(
        `Nguồn thời tiết '${provider}' không hợp lệ (hỗ trợ: auto, tomorrow_io, weatherapi, google, open_meteo).`
      );
      err.statusCode = 400;
      throw err;
    }

    const reqStart = performance.now();
    totalRequests += 1;

    pruneWeatherCache();
    const keyHash = hashApiKeys({ tomorrowIoApiKey, weatherApiKey, googleApiKey });
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)},${provider},${keyHash}`;
    const now = Date.now();

    const resolveEffectiveLocationName = (cachedName) => {
      if (hasExplicitName && locationName) {
        return locationName;
      }
      if (cachedName && cachedName !== 'Vị trí hiện tại') {
        return cachedName;
      }
      return locationName || cachedName || 'Vị trí hiện tại';
    };

    if (!force) {
      const cached = weatherCache.get(cacheKey);
      if (cached && cached.expiresAtMs > now) {
        cacheHits += 1;
        // LRU promotion so frequently queried locations remain hot in cache
        weatherCache.delete(cacheKey);
        weatherCache.set(cacheKey, cached);
        const snapshot = {
          ...cached.snapshot,
          locationName: resolveEffectiveLocationName(cached.snapshot.locationName),
        };
        const decision = evaluateCharacterDecision(snapshot, { gender, sensitivity });
        const latencyMs = Math.max(0, Math.round(performance.now() - reqStart));
        const expiresAtIso = new Date(cached.expiresAtMs).toISOString();

        const telemetryEntry = buildTelemetryEntry({
          snapshot,
          cacheHit: true,
          latencyMs,
        });
        await runtimeStore.recordTelemetry(telemetryEntry);

        return {
          snapshot,
          decision,
          cacheHit: true,
          latencyMs,
          expiresAtIso,
        };
      }
    }

    function ensureBackgroundWeatherRefresh(inflightKey) {
      let existing = inFlightWeather.get(inflightKey);
      if (!existing) {
        existing = (async () => {
          const rawSnapshot = await fetchWeatherSnapshot({
            latitude,
            longitude,
            locationName,
            provider,
            tomorrowIoApiKey,
            weatherApiKey,
            googleApiKey,
            fetchImpl: timedFetch,
            enableConsensus: false,
          });
          const fetchedSnapshot = enableConsensus
            ? await weatherVerifier.enrichSnapshot(rawSnapshot, { force })
            : rawSnapshot;
          const storedAt = Date.now();
          const entry = {
            snapshot: fetchedSnapshot,
            createdAtMs: storedAt,
            expiresAtMs: storedAt + cacheTtlMs,
          };
          weatherCache.delete(cacheKey);
          weatherCache.set(cacheKey, entry);
          if (staleGraceMs > 0) {
            staleWeatherCache.delete(cacheKey);
            staleWeatherCache.set(cacheKey, {
              snapshot: fetchedSnapshot,
              expiresAtMs: entry.expiresAtMs,
              staleUntilMs: entry.expiresAtMs + staleGraceMs,
            });
          }
          return entry;
        })();
        inFlightWeather.set(inflightKey, existing);
        existing.finally(() => {
          if (inFlightWeather.get(inflightKey) === existing) {
            inFlightWeather.delete(inflightKey);
          }
        }).catch(() => {});
      }
      return existing;
    }

    // Stale-While-Revalidate (SWR): return warm snapshot in <1ms after 15-min TTL while refreshing in background
    if (!force && staleGraceMs > 0) {
      const staleEntry = staleWeatherCache.get(cacheKey);
      if (staleEntry && staleEntry.staleUntilMs > now) {
        cacheHits += 1;
        ensureBackgroundWeatherRefresh(cacheKey).catch(() => {});
        const snapshot = {
          ...staleEntry.snapshot,
          locationName: resolveEffectiveLocationName(staleEntry.snapshot.locationName),
        };
        const decision = evaluateCharacterDecision(snapshot, { gender, sensitivity });
        const latencyMs = Math.max(0, Math.round(performance.now() - reqStart));
        const expiresAtIso = new Date(staleEntry.expiresAtMs).toISOString();

        const telemetryEntry = buildTelemetryEntry({
          snapshot,
          cacheHit: true,
          latencyMs,
        });
        await runtimeStore.recordTelemetry(telemetryEntry);

        return {
          snapshot,
          decision,
          cacheHit: true,
          staleRevalidating: true,
          latencyMs,
          expiresAtIso,
        };
      }
    }

    // Singleflight coalescing for both normal and concurrent force=true bursts
    const inflightKey = force ? `${cacheKey}:force` : cacheKey;
    const fetchPromise = ensureBackgroundWeatherRefresh(inflightKey);

    const entry = await fetchPromise;
    const snapshot = {
      ...entry.snapshot,
      locationName: resolveEffectiveLocationName(entry.snapshot.locationName),
    };
    const decision = evaluateCharacterDecision(snapshot, { gender, sensitivity });
    const latencyMs = Math.max(0, Math.round(performance.now() - reqStart));
    const expiresAtIso = new Date(entry.expiresAtMs).toISOString();

    const telemetryEntry = buildTelemetryEntry({
      snapshot,
      cacheHit: false,
      latencyMs,
    });
    await runtimeStore.recordTelemetry(telemetryEntry);

    return {
      snapshot,
      decision,
      cacheHit: false,
      latencyMs,
      expiresAtIso,
    };
  }

  async function serveStaticFile(req, res, filePath, cacheControl) {
    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        return false;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isHtml = ext === '.html';
      const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', cacheControl);
      res.setHeader('ETag', etag);
      if (isHtml) {
        res.setHeader('Content-Security-Policy', HTML_CONTENT_SECURITY_POLICY);
      }

      const canCompress =
        COMPRESSIBLE_EXTENSIONS.has(ext) && stat.size >= 1024 && stat.size <= 12 * 1024 * 1024;
      if (canCompress) {
        res.setHeader('Vary', 'Accept-Encoding');
      }

      const ifNoneMatch = readHeaderString(req.headers, 'if-none-match');
      if (ifNoneMatch && ifNoneMatch === etag) {
        res.statusCode = 304;
        res.end();
        return true;
      }

      const encoding = canCompress
        ? negotiateCompression(req.headers['accept-encoding'])
        : null;

      if (encoding) {
        const assetCacheKey = `${filePath}:${Math.trunc(stat.mtimeMs)}:${stat.size}:${encoding}`;
        let compressedBuf = compressedAssetCache.get(assetCacheKey);
        if (!compressedBuf) {
          const rawBuf = await fsp.readFile(filePath);
          compressedBuf =
            encoding === 'br'
              ? await brotliCompressAsync(rawBuf, {
                  params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
                  },
                })
              : await gzipAsync(rawBuf, { level: 6 });
          if (compressedAssetCache.size >= MAX_COMPRESSED_ASSET_CACHE) {
            const oldest = compressedAssetCache.keys().next().value;
            if (oldest !== undefined) compressedAssetCache.delete(oldest);
          }
          compressedAssetCache.set(assetCacheKey, compressedBuf);
        } else {
          compressedAssetCache.delete(assetCacheKey);
          compressedAssetCache.set(assetCacheKey, compressedBuf);
        }

        res.statusCode = 200;
        res.setHeader('Content-Encoding', encoding);
        res.setHeader('Content-Length', compressedBuf.byteLength);
        if (req.method === 'HEAD') {
          res.end();
          return true;
        }
        res.end(compressedBuf);
        return true;
      }

      res.statusCode = 200;
      res.setHeader('Content-Length', stat.size);

      if (req.method === 'HEAD') {
        res.end();
        return true;
      }

      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        stream.on('error', reject);
        res.on('close', resolve);
        stream.pipe(res);
      });
      return true;
    } catch {
      return false;
    }
  }

  async function handleStaticRequest(req, res, rawUrl, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { status: 'error', error: 'Method Not Allowed' });
      return;
    }

    let decodedPathname = '/';
    try {
      decodedPathname = decodeURIComponent(pathname || '/');
    } catch {
      sendJson(res, 400, { status: 'error', error: 'Đường dẫn URL không hợp lệ.' });
      return;
    }

    // Block raw `..`, encoded `%2e%2e`, backslashes, null bytes, and dotfile secrets (`/.env`, `/.git`)
    if (isSuspiciousStaticPath(rawUrl, decodedPathname)) {
      sendJson(res, 403, { status: 'error', error: 'Truy cập đường dẫn bị từ chối.' });
      return;
    }

    // Allow serving packaged .zip downloads directly from public/downloads/ even before export:web
    if (decodedPathname.startsWith('/downloads/')) {
      const downloadRel = decodedPathname.replace(/^\/+/, '');
      const publicCandidate = path.resolve(publicDir, downloadRel);
      const publicRelCheck = path.relative(publicDir, publicCandidate);
      if (publicRelCheck.startsWith('..') || path.isAbsolute(publicRelCheck)) {
        sendJson(res, 403, { status: 'error', error: 'Truy cập đường dẫn bị từ chối.' });
        return;
      }
      const servedPublicDownload = await serveStaticFile(
        req,
        res,
        publicCandidate,
        'no-cache'
      );
      if (servedPublicDownload) {
        return;
      }
    }

    const indexHtmlPath = path.join(distDir, 'index.html');
    const hasDistBuild = fs.existsSync(indexHtmlPath);

    if (!hasDistBuild) {
      sendJson(res, 200, {
        status: 'ok',
        service: 'weather-buddy-backend',
        version: SERVER_VERSION,
        messageVi:
          'Backend API đang hoạt động. Chạy `npm run export:web` để xuất giao diện tĩnh vào thư mục dist/.',
        endpoints: [
          '/api/health',
          '/api/security/status',
          '/api/weather',
          '/api/weather-verify',
          '/api/reverse-geocode',
          '/api/dashboard/overview',
          '/api/widget-sync',
          '/api/pc-suite/status',
          '/api/pc-widget/launch',
        ],
      });
      return;
    }

    const relativeTarget = decodedPathname.replace(/^\/+/, '');
    const candidatePath = path.resolve(distDir, relativeTarget || 'index.html');
    const relCheck = path.relative(distDir, candidatePath);

    if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
      sendJson(res, 403, { status: 'error', error: 'Truy cập đường dẫn bị từ chối.' });
      return;
    }

    const isImmutableAsset =
      decodedPathname.startsWith('/_expo/') || decodedPathname.startsWith('/assets/');
    const assetCacheHeader = isImmutableAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

    const servedDirect = await serveStaticFile(req, res, candidatePath, assetCacheHeader);
    if (servedDirect) {
      return;
    }

    // SPA fallback for extensionless client routes (e.g. /, /dashboard, /widgets)
    const hasExtension = path.extname(relativeTarget) !== '';
    if (!hasExtension) {
      const servedFallback = await serveStaticFile(req, res, indexHtmlPath, 'no-cache');
      if (servedFallback) {
        return;
      }
    }

    sendJson(res, 404, { status: 'error', error: 'Không tìm thấy tài nguyên tĩnh.' });
  }

  function enforceRateLimit(req, res, bucketName) {
    const clientIp = req.socket?.remoteAddress || '127.0.0.1';
    const check = rateLimiter.consume(bucketName, clientIp);
    res.setHeader('X-RateLimit-Limit', String(check.limit));
    res.setHeader('X-RateLimit-Remaining', String(check.remaining));

    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      sendJson(res, 429, {
        status: 'error',
        error: 'Quá nhiều yêu cầu trong thời gian ngắn (429 Too Many Requests). Vui lòng thử lại sau.',
        retryAfterSec: check.retryAfterSec,
      });
      return false;
    }
    return true;
  }

  const server = http.createServer(async (req, res) => {
    const rawUrl = req.url || '/';
    res._acceptEncoding = readHeaderString(req.headers, 'accept-encoding');

    // Pre-parse traversal check on raw HTTP request target before URL normalization
    const rawPathPart = rawUrl.split('?')[0];
    if (
      rawPathPart.includes('\0') ||
      rawPathPart.includes('\\') ||
      /(?:^|\/)\.\.(?:\/|$)/i.test(rawPathPart) ||
      /%2e%2e/i.test(rawPathPart) ||
      /%5c/i.test(rawPathPart)
    ) {
      applyHardenedHeaders(req, res, { isApi: false });
      sendJson(res, 403, { status: 'error', error: 'Truy cập đường dẫn bị từ chối.' });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl, 'http://localhost');
    } catch {
      applyHardenedHeaders(req, res, { isApi: true });
      sendJson(res, 400, { status: 'error', error: 'URL không hợp lệ.' });
      return;
    }

    const pathname = parsedUrl.pathname;
    const isApi = pathname === '/api' || pathname.startsWith('/api/');

    const originCheck = applyHardenedHeaders(req, res, { isApi });

    if (req.method === 'OPTIONS') {
      if (originCheck.present && !originCheck.trusted) {
        sendJson(res, 403, {
          status: 'error',
          error: 'Origin không được phép truy cập CORS.',
        });
        return;
      }
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!isApi) {
      await handleStaticRequest(req, res, rawUrl, pathname);
      return;
    }

    // Block cross-site state-changing requests from untrusted Origins
    const mutationOriginCheck = verifyTrustedOriginForMutation(req);
    if (!mutationOriginCheck.ok) {
      sendJson(res, mutationOriginCheck.statusCode, {
        status: 'error',
        error: mutationOriginCheck.error,
      });
      return;
    }

    // Sliding-window rate limiting per endpoint bucket
    const rateBucket =
      pathname === '/api/weather'
        ? 'weather'
        : pathname === '/api/pc-widget/launch'
          ? 'pcWidgetLaunch'
          : 'defaultApi';
    if (!enforceRateLimit(req, res, rateBucket)) {
      return;
    }

    let requestSecrets = [];
    try {
      // 1. GET /api/health
      if (pathname === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, buildServerHealth());
        return;
      }

      // 2. GET /api/security/status
      if (pathname === '/api/security/status' && req.method === 'GET') {
        sendJson(res, 200, {
          status: 'ok',
          rateLimitActive: true,
          csrfProtected: true,
          keyRedaction: true,
          headersHardened: true,
          loopbackGuardOnLaunch: true,
          maxBodyBytes,
          upstreamTimeoutMs,
          rateLimits: {
            weatherPerMinute: rateLimiter.limits.weather.max,
            pcWidgetLaunchPerMinute: rateLimiter.limits.pcWidgetLaunch.max,
          },
        });
        return;
      }

      // 3. GET | POST /api/weather
      if (pathname === '/api/weather' && (req.method === 'GET' || req.method === 'POST')) {
        const body = req.method === 'POST' ? await readJsonBody(req, maxBodyBytes) : {};
        const keys = extractRequestApiKeys(req, body);
        requestSecrets = [keys.tomorrowIoApiKey, keys.weatherApiKey, keys.googleApiKey];

        const q = parsedUrl.searchParams;
        const rawLat = body.lat ?? body.latitude ?? q.get('lat') ?? q.get('latitude');
        const rawLon =
          body.lon ??
          body.lng ??
          body.longitude ??
          q.get('lon') ??
          q.get('lng') ??
          q.get('longitude');

        const { latitude, longitude, usedDefault } = parseCoordinates(
          rawLat,
          rawLon,
          PRESET_CITIES[0]
        );
        const explicitName = body.locationName ?? q.get('locationName');
        const hasExplicitName = typeof explicitName === 'string' && explicitName.trim().length > 0;
        const locationName =
          usedDefault && !hasExplicitName
            ? PRESET_CITIES[0].nameVi
            : inferCityName(latitude, longitude, explicitName);

        const provider = String(body.provider ?? q.get('provider') ?? 'auto').trim();
        const force = parseForceFlag(body.force ?? q.get('force'));
        const gender = parseGender(body.gender ?? q.get('gender'));
        const sensitivity = parseSensitivity(body.sensitivity ?? q.get('sensitivity'));

        const result = await getOrFetchWeather({
          latitude,
          longitude,
          locationName,
          hasExplicitName,
          provider,
          force,
          gender,
          sensitivity,
          ...keys,
        });

        sendJson(res, 200, result);
        return;
      }

      // 3b. GET /api/weather-verify (5-minute cached NOAA Aviation METAR + MET Norway ECMWF cross-validation)
      if (pathname === '/api/weather-verify' && req.method === 'GET') {
        const q = parsedUrl.searchParams;
        const rawLat = q.get('lat') ?? q.get('latitude');
        const rawLon = q.get('lon') ?? q.get('lng') ?? q.get('longitude');
        const { latitude, longitude } = parseCoordinates(rawLat, rawLon, null);
        const force = parseForceFlag(q.get('force'));

        const verifyResult = await weatherVerifier.verifyLocation(latitude, longitude, { force });
        sendJson(res, 200, verifyResult);
        return;
      }

      // 4. GET /api/reverse-geocode
      if (pathname === '/api/reverse-geocode' && req.method === 'GET') {
        const q = parsedUrl.searchParams;
        const rawLat = q.get('lat') ?? q.get('latitude');
        const rawLon = q.get('lon') ?? q.get('lng') ?? q.get('longitude');
        const { latitude, longitude } = parseCoordinates(rawLat, rawLon, null);

        const geoResult = await reverseGeocode(latitude, longitude);
        sendJson(res, 200, geoResult);
        return;
      }

      // 4b. GET /api/auto-locate (Zero-key network geolocation fallback when browser GPS is unavailable/denied)
      if (pathname === '/api/auto-locate' && req.method === 'GET') {
        const force = parseForceFlag(parsedUrl.searchParams.get('force'));
        const locResult = await autoLocate({ force });
        sendJson(res, 200, locResult);
        return;
      }

      // 4c. GET /api/geocode-search?q=<query>&limit=8 (Vietnamese + Global city/district search autocomplete)
      if (pathname === '/api/geocode-search' && req.method === 'GET') {
        const rawQ = String(parsedUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
        const rawLimit = Number(parsedUrl.searchParams.get('limit') ?? 8);
        const results = await searchPlaces(rawQ, rawLimit);
        sendJson(res, 200, {
          status: 'ok',
          query: rawQ,
          results,
        });
        return;
      }

      // 5. GET /api/dashboard/overview
      if (pathname === '/api/dashboard/overview' && req.method === 'GET') {
        const keys = extractRequestApiKeys(req);
        requestSecrets = [keys.tomorrowIoApiKey, keys.weatherApiKey, keys.googleApiKey];

        const q = parsedUrl.searchParams;
        const widgetRecord = runtimeStore.getWidgetSync();
        const syncedWidget = widgetRecord ? widgetRecord.payload : null;

        const defaultCity = syncedWidget
          ? {
              latitude: syncedWidget.latitude || PRESET_CITIES[0].latitude,
              longitude: syncedWidget.longitude || PRESET_CITIES[0].longitude,
              nameVi: syncedWidget.locationName || PRESET_CITIES[0].nameVi,
            }
          : PRESET_CITIES[0];

        const rawLat = q.get('lat') ?? q.get('latitude');
        const rawLon = q.get('lon') ?? q.get('lng') ?? q.get('longitude');
        const { latitude, longitude, usedDefault } = parseCoordinates(
          rawLat,
          rawLon,
          defaultCity
        );

        const explicitName = q.get('locationName');
        const hasExplicitName = typeof explicitName === 'string' && explicitName.trim().length > 0;
        const locationName =
          usedDefault && !hasExplicitName
            ? defaultCity.nameVi
            : inferCityName(latitude, longitude, explicitName);

        const provider = String(q.get('provider') ?? 'auto').trim();
        const force = parseForceFlag(q.get('force'));
        const gender = parseGender(q.get('gender') ?? syncedWidget?.gender);
        const sensitivity = parseSensitivity(q.get('sensitivity'));

        const weatherResult = await getOrFetchWeather({
          latitude,
          longitude,
          locationName,
          hasExplicitName,
          provider,
          force,
          gender,
          sensitivity,
          ...keys,
        });

        const analytics24h = computeAnalytics24h(weatherResult.snapshot);
        const serverHealth = buildServerHealth();
        const recentTelemetry = runtimeStore.getRecentTelemetry(15);

        sendJson(res, 200, {
          status: 'ok',
          generatedAtIso: new Date().toISOString(),
          serverHealth,
          activeLocation: {
            locationName: weatherResult.snapshot.locationName,
            latitude,
            longitude,
          },
          snapshot: weatherResult.snapshot,
          decision: weatherResult.decision,
          cacheHit: weatherResult.cacheHit,
          expiresAtIso: weatherResult.expiresAtIso,
          analytics24h,
          recentTelemetry,
          syncedWidget,
        });
        return;
      }

      // 6. GET | POST | DELETE /api/widget-sync
      if (pathname === '/api/widget-sync') {
        if (req.method === 'GET') {
          const record = runtimeStore.getWidgetSync();
          sendJson(res, 200, {
            status: 'ok',
            synced: Boolean(record),
            syncedAtIso: record?.syncedAtIso ?? null,
            payload: record?.payload ?? null,
          });
          return;
        }

        if (req.method === 'POST') {
          const body = await readJsonBody(req, maxBodyBytes);
          let record;
          try {
            record = await runtimeStore.saveWidgetSync(body);
          } catch (validationErr) {
            validationErr.statusCode = 400;
            throw validationErr;
          }
          sendJson(res, 200, {
            status: 'ok',
            synced: true,
            syncedAtIso: record.syncedAtIso,
            storageKey: 'server:.runtime/widget_sync.json',
            payload: record.payload,
          });
          return;
        }

        if (req.method === 'DELETE') {
          await runtimeStore.clearWidgetSync();
          sendJson(res, 200, {
            status: 'ok',
            synced: false,
            cleared: true,
          });
          return;
        }

        sendJson(res, 405, { status: 'error', error: 'Method Not Allowed' });
        return;
      }

      // 7. GET /api/pc-suite/status
      if (pathname === '/api/pc-suite/status' && req.method === 'GET') {
        const extensionManifestPath = path.join(
          projectRoot,
          'browser-extension',
          'manifest.json'
        );
        const desktopLauncherPath = path.join(
          projectRoot,
          'desktop-widget',
          'Launch-Desktop-Widget.ps1'
        );
        const extZipReady =
          fs.existsSync(path.join(distDir, 'downloads', 'weather-buddy-extension.zip')) ||
          fs.existsSync(path.join(publicDir, 'downloads', 'weather-buddy-extension.zip'));
        const desktopZipReady =
          fs.existsSync(
            path.join(distDir, 'downloads', 'weather-buddy-desktop-widget.zip')
          ) ||
          fs.existsSync(
            path.join(publicDir, 'downloads', 'weather-buddy-desktop-widget.zip')
          );

        const extensionReady = fs.existsSync(extensionManifestPath);
        const desktopWidgetReady = fs.existsSync(desktopLauncherPath);

        sendJson(res, 200, {
          status: 'ok',
          platform: process.platform,
          canLaunchNativeDesktopWidget:
            process.platform === 'win32' &&
            isStrictLoopback(req.socket?.remoteAddress) &&
            desktopWidgetReady,
          extensionReady,
          desktopWidgetReady,
          extensionZipReady: extZipReady,
          desktopWidgetZipReady: desktopZipReady,
          downloads: PC_SUITE_DOWNLOADS,
        });
        return;
      }

      // 8. POST /api/pc-widget/launch (Loopback + CSRF + Strict Enum Allowlist)
      if (pathname === '/api/pc-widget/launch' && req.method === 'POST') {
        if (!isStrictLoopback(req.socket?.remoteAddress)) {
          sendJson(res, 403, {
            status: 'error',
            launched: false,
            error: 'Chỉ cho phép khởi chạy Desktop Widget từ kết nối nội bộ (localhost).',
          });
          return;
        }

        const csrfCheck = verifyCsrfHeader(req);
        if (!csrfCheck.ok) {
          sendJson(res, csrfCheck.statusCode, {
            status: 'error',
            launched: false,
            error: csrfCheck.error,
          });
          return;
        }

        const body = await readJsonBody(req, maxBodyBytes);
        const corner = body.corner === undefined ? 'BottomRight' : String(body.corner);
        const size = body.size === undefined ? 'Standard' : String(body.size);
        const gender = body.gender === undefined ? 'female' : String(body.gender);

        if (!ALLOWED_WIDGET_CORNERS.has(corner)) {
          const err = new Error(
            'Giá trị corner không hợp lệ (chấp nhận: BottomRight, TopRight, BottomLeft, TopLeft).'
          );
          err.statusCode = 400;
          throw err;
        }
        if (!ALLOWED_WIDGET_SIZES.has(size)) {
          const err = new Error('Giá trị size không hợp lệ (chấp nhận: Compact, Standard).');
          err.statusCode = 400;
          throw err;
        }
        if (!ALLOWED_GENDERS.has(gender)) {
          const err = new Error('Giá trị gender không hợp lệ (chấp nhận: male, female).');
          err.statusCode = 400;
          throw err;
        }

        if (process.platform !== 'win32') {
          sendJson(res, 400, {
            status: 'error',
            launched: false,
            error: 'Tính năng mở trực tiếp Windows Desktop Widget chỉ hỗ trợ trên Windows.',
          });
          return;
        }

        const scriptPath = path.join(
          projectRoot,
          'desktop-widget',
          'Launch-Desktop-Widget.ps1'
        );
        if (!fs.existsSync(scriptPath)) {
          sendJson(res, 404, {
            status: 'error',
            launched: false,
            error: 'Chưa tìm thấy bộ khởi chạy desktop-widget/Launch-Desktop-Widget.ps1.',
          });
          return;
        }

        const psArgs = [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-Corner',
          corner,
          '-Size',
          size,
          '-Gender',
          gender,
        ];

        const child = spawnImpl('powershell.exe', psArgs, {
          cwd: path.dirname(scriptPath),
          detached: true,
          stdio: 'ignore',
          shell: false,
          windowsHide: true,
        });
        child?.unref?.();

        sendJson(res, 200, {
          status: 'ok',
          launched: true,
          mode: size,
          size,
          corner,
          gender,
        });
        return;
      }

      // 9. GET /api/map-tile?z=&x=&y= (OSM-policy-compliant User-Agent + 24h in-memory LRU cache)
      if (pathname === '/api/map-tile' && req.method === 'GET') {
        const z = Number(parsedUrl.searchParams.get('z'));
        const x = Number(parsedUrl.searchParams.get('x'));
        const y = Number(parsedUrl.searchParams.get('y'));
        const maxCoord = Number.isInteger(z) && z >= 0 && z <= 12 ? Math.pow(2, z) : -1;
        if (
          maxCoord < 1 ||
          !Number.isInteger(x) ||
          !Number.isInteger(y) ||
          x < 0 ||
          x >= maxCoord ||
          y < 0 ||
          y >= maxCoord
        ) {
          sendJson(res, 400, { status: 'error', error: 'Tham số ô bản đồ z/x/y không hợp lệ.' });
          return;
        }

        if (!server._mapTileCache) {
          server._mapTileCache = new Map();
        }
        const tileCache = server._mapTileCache;
        const tileKey = `${z}/${x}/${y}`;
        const etag = `W/"osm-${z}-${x}-${y}"`;

        if (readHeaderString(req.headers, 'if-none-match') === etag) {
          res.statusCode = 304;
          res.end();
          return;
        }

        const nowMs = Date.now();
        const cachedTile = tileCache.get(tileKey);
        if (cachedTile && nowMs < cachedTile.expiresAtMs) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('ETag', etag);
          res.setHeader('Content-Length', cachedTile.buf.byteLength);
          res.end(cachedTile.buf);
          return;
        }

        const upstreamRes = await timedFetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
          headers: {
            'User-Agent': 'WeatherBuddy/3.0 (+https://github.com/Okazane/weather-buddy)',
            Accept: 'image/png,image/*;q=0.9',
          },
        });
        if (!upstreamRes.ok) {
          sendJson(res, 502, { status: 'error', error: 'Không tải được ô bản đồ nền.' });
          return;
        }
        const buf = Buffer.from(await upstreamRes.arrayBuffer());
        if (tileCache.size >= 180) {
          const oldestKey = tileCache.keys().next().value;
          if (oldestKey !== undefined) tileCache.delete(oldestKey);
        }
        tileCache.set(tileKey, { buf, expiresAtMs: nowMs + 24 * 60 * 60 * 1000 });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('ETag', etag);
        res.setHeader('Content-Length', buf.byteLength);
        res.end(buf);
        return;
      }

      sendJson(res, 404, {
        status: 'error',
        error: `Endpoint '${pathname}' không tồn tại.`,
      });
    } catch (err) {
      const statusCode =
        typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500;
      const rawMessage =
        err instanceof Error
          ? err.message
          : 'Lỗi máy chủ nội bộ khi xử lý yêu cầu thời tiết.';
      const safeMessage = redactSecrets(rawMessage, requestSecrets);

      sendJson(res, statusCode, {
        status: 'error',
        error: safeMessage,
      });
    }
  });

  server.getBaseUrl = () => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return `http://localhost:${DEFAULT_PORT}`;
    }
    const host =
      addr.address === '::' || addr.address === '0.0.0.0' ? '127.0.0.1' : addr.address;
    return `http://${host}:${addr.port}`;
  };

  server.start = (port = DEFAULT_PORT, host = '127.0.0.1') =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        const addr = server.address();
        const boundPort = typeof addr === 'object' && addr ? addr.port : port;
        resolve({
          port: boundPort,
          host,
          baseUrl: server.getBaseUrl(),
        });
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });

  server.shutdown = async () => {
    await runtimeStore.flush();
    if (!server.listening) {
      return;
    }
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  // Safe read-only diagnostics for E2E tests (never exposes raw keys or salt)
  server.diagnostics = {
    getCacheKeys: () => Array.from(weatherCache.keys()),
    getRuntimeDir: () => runtimeDir,
    flushRuntime: () => runtimeStore.flush(),
  };

  return server;
}

// Auto-start when executed directly via `node server/index.mjs`
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const currentModulePath = fileURLToPath(import.meta.url);

if (invokedPath && invokedPath === currentModulePath) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT) || 8787;
  const appServer = createWeatherBuddyServer({
    localKeysFile: path.join(DEFAULT_RUNTIME_DIR, 'local-provider-keys.json'),
  });

  appServer
    .start(port, host)
    .then(({ port: boundPort }) => {
      console.log(
        `[WeatherBuddy Backend v${SERVER_VERSION}] Listening on http://localhost:${boundPort} (15-min cache + security hardening active)`
      );
    })
    .catch((err) => {
      console.error(
        '[WeatherBuddy Backend] Failed to start:',
        redactSecrets(String(err?.message || err))
      );
      process.exitCode = 1;
    });

  const gracefulExit = async () => {
    try {
      await appServer.shutdown();
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', gracefulExit);
  process.once('SIGTERM', gracefulExit);
}
