import crypto from 'node:crypto';

export const MAX_REQUEST_BODY_BYTES = 16 * 1024; // 16 KB strict cap
export const UPSTREAM_FETCH_TIMEOUT_MS = 10_000; // 10s hard timeout
export const CSRF_CLIENT_HEADER = 'x-weatherbuddy-client';
export const CSRF_EXPECTED_VALUE = 'weatherbuddy-ui';

export const DEFAULT_RATE_LIMITS = {
  weather: { windowMs: 60_000, max: 60 },
  pcWidgetLaunch: { windowMs: 60_000, max: 10 },
  defaultApi: { windowMs: 60_000, max: 120 },
};

export const HTML_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.open-meteo.com https://air-quality-api.open-meteo.com https://api.tomorrow.io https://api.weatherapi.com https://weather.googleapis.com https://api.bigdatacloud.net https://nominatim.openstreetmap.org https://ipwho.is https://get.geojs.io",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Per-process cryptographic random salt so SHA-256 cache keys cannot be rainbow-tabled
const PROCESS_KEY_HASH_SALT = crypto.randomBytes(32);

/**
 * Scrubs API keys, URL secret parameters, Google `AIza...` tokens, and Bearer tokens
 * from any string before returning to clients or writing to logs.
 */
export function redactSecrets(input, rawSecrets = []) {
  if (typeof input !== 'string' || input.length === 0) {
    return '';
  }
  let sanitized = input;

  for (const secret of rawSecrets) {
    if (typeof secret === 'string') {
      const trimmed = secret.trim();
      if (trimmed.length >= 3) {
        sanitized = sanitized.split(trimmed).join('[REDACTED]');
      }
    }
  }

  // Scrub URL query parameters carrying credentials
  sanitized = sanitized.replace(
    /([?&](?:key|apikey|api_key|token|access_token|secret)=)([^&\s"'#]+)/gi,
    '$1[REDACTED]'
  );

  // Scrub Google Cloud API keys (AIza...)
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z_-]{12,}\b/g, '[REDACTED_GOOGLE_KEY]');

  // Scrub Authorization / Bearer tokens
  sanitized = sanitized.replace(
    /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
    '$1[REDACTED]'
  );

  return sanitized;
}

/**
 * Computes a salted SHA-256 digest for cache-key isolation so raw user keys are never kept in memory.
 */
export function hashApiKeysSalted({
  tomorrowIoApiKey = '',
  weatherApiKey = '',
  googleApiKey = '',
}) {
  const t = String(tomorrowIoApiKey || '').trim();
  const w = String(weatherApiKey || '').trim();
  const g = String(googleApiKey || '').trim();
  if (!t && !w && !g) {
    return 'free-open-meteo';
  }
  return crypto
    .createHmac('sha256', PROCESS_KEY_HASH_SALT)
    .update(`t:${t}|w:${w}|g:${g}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
}

/**
 * Checks whether a remote socket address is strict loopback.
 */
export function isStrictLoopback(remoteAddress) {
  if (!remoteAddress || typeof remoteAddress !== 'string') {
    return false;
  }
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

/**
 * Parses optional comma-separated `process.env.ALLOWED_ORIGINS` and validates request Origin
 * against strict local/extension allowlist.
 */
export function evaluateCorsOrigin(originHeader, envAllowedOrigins = process.env.ALLOWED_ORIGINS) {
  if (!originHeader || typeof originHeader !== 'string') {
    return { present: false, trusted: true, allowOrigin: null };
  }

  const normalized = originHeader.trim();
  if (!normalized) {
    return { present: false, trusted: true, allowOrigin: null };
  }

  if (
    /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(normalized) ||
    /^(chrome-extension|moz-extension|safari-web-extension):\/\/[a-z0-9_-]+$/i.test(
      normalized
    )
  ) {
    return { present: true, trusted: true, allowOrigin: normalized };
  }

  if (typeof envAllowedOrigins === 'string' && envAllowedOrigins.trim()) {
    const customAllowed = envAllowedOrigins
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (customAllowed.includes(normalized)) {
      return { present: true, trusted: true, allowOrigin: normalized };
    }
  }

  return { present: true, trusted: false, allowOrigin: null };
}

/**
 * Applies hardened security and strict CORS headers to HTTP responses.
 */
export function applyHardenedHeaders(req, res, { isApi = false, isHtml = false } = {}) {
  const originCheck = evaluateCorsOrigin(req.headers.origin);

  if (originCheck.trusted && originCheck.allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', originCheck.allowOrigin);
    res.setHeader('Vary', 'Origin');
  } else if (!originCheck.present && isApi) {
    // Same-origin / non-browser local clients without Origin header
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-WeatherBuddy-Client, X-Google-Api-Key, X-Tomorrow-Api-Key, X-Weatherapi-Key, Accept, Origin'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  // Mandatory Enterprise Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), payment=(), geolocation=(self)'
  );
  res.setHeader(
    'Cross-Origin-Resource-Policy',
    isApi ? 'cross-origin' : 'same-origin'
  );

  if (isHtml) {
    res.setHeader('Content-Security-Policy', HTML_CONTENT_SECURITY_POLICY);
  }

  if (isApi) {
    res.setHeader('Cache-Control', 'no-store');
  }

  return originCheck;
}

/**
 * Validates that a state-changing request does not originate from an untrusted cross-site Origin.
 */
export function verifyTrustedOriginForMutation(req) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { ok: true };
  }
  const originCheck = evaluateCorsOrigin(req.headers.origin);
  if (originCheck.present && !originCheck.trusted) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Origin không nằm trong danh sách tin cậy (CORS/CSRF bị chặn).',
    };
  }
  return { ok: true };
}

/**
 * Verifies the custom anti-CSRF client header required on sensitive local mutation endpoints.
 */
export function verifyCsrfHeader(req) {
  const raw = req.headers[CSRF_CLIENT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.trim() !== CSRF_EXPECTED_VALUE) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Thiếu hoặc sai header bảo mật CSRF (X-WeatherBuddy-Client: weatherbuddy-ui).',
    };
  }
  return { ok: true };
}

/**
 * Detects raw path traversal attempts (`..`, encoded `%2e%2e`, backslashes, null bytes)
 * or dotfile probes (`/.env`, `/.git`) BEFORE URL canonicalization can mask them.
 */
export function isSuspiciousStaticPath(rawUrl, decodedPathname) {
  const rawPathPart = String(rawUrl || '').split('?')[0];
  if (
    rawPathPart.includes('\0') ||
    rawPathPart.includes('\\') ||
    /(?:^|\/)\.\.(?:\/|$)/i.test(rawPathPart) ||
    /%2e%2e/i.test(rawPathPart) ||
    /%2f\.\./i.test(rawPathPart) ||
    /%5c/i.test(rawPathPart)
  ) {
    return true;
  }

  const segments = String(decodedPathname || '')
    .split('/')
    .filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || seg.startsWith('.')) {
      return true;
    }
  }
  return false;
}

/**
 * Sliding-window per-IP rate limiter using in-memory timestamp rings.
 */
export class SlidingWindowRateLimiter {
  constructor(limits = DEFAULT_RATE_LIMITS) {
    this.limits = {
      weather: { ...DEFAULT_RATE_LIMITS.weather, ...(limits.weather || {}) },
      pcWidgetLaunch: {
        ...DEFAULT_RATE_LIMITS.pcWidgetLaunch,
        ...(limits.pcWidgetLaunch || {}),
      },
      defaultApi: {
        ...DEFAULT_RATE_LIMITS.defaultApi,
        ...(limits.defaultApi || {}),
      },
    };
    this.buckets = new Map();
  }

  _pruneExpired(now) {
    if (this.buckets.size < 500) return;
    for (const [key, timestamps] of this.buckets.entries()) {
      if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 120_000) {
        this.buckets.delete(key);
      }
    }
  }

  consume(bucketName, clientIp = '127.0.0.1') {
    const rule = this.limits[bucketName] || this.limits.defaultApi;
    const now = Date.now();
    this._pruneExpired(now);

    const key = `${bucketName}:${clientIp}`;
    const windowStart = now - rule.windowMs;
    const existing = this.buckets.get(key) || [];
    const active = existing.filter((ts) => ts > windowStart);

    if (active.length >= rule.max) {
      const oldestInWindow = active[0] || now;
      const retryAfterSec = Math.max(
        1,
        Math.ceil((oldestInWindow + rule.windowMs - now) / 1000)
      );
      this.buckets.set(key, active);
      return {
        allowed: false,
        limit: rule.max,
        remaining: 0,
        retryAfterSec,
      };
    }

    active.push(now);
    this.buckets.set(key, active);

    return {
      allowed: true,
      limit: rule.max,
      remaining: Math.max(0, rule.max - active.length),
      retryAfterSec: 0,
    };
  }
}

/**
 * Wraps an outbound `fetch` implementation with `AbortSignal.timeout(timeoutMs)`
 * so stalled upstream weather/geocoding providers can never hang server sockets.
 */
export function createTimeoutFetch(baseFetch = globalThis.fetch, timeoutMs = UPSTREAM_FETCH_TIMEOUT_MS) {
  return async function timedFetch(url, init = {}) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    return baseFetch(url, {
      ...init,
      signal,
    });
  };
}
