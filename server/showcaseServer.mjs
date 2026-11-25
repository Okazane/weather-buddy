import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  UPSTREAM_FETCH_TIMEOUT_MS,
  evaluateCorsOrigin,
  isSuspiciousStaticPath,
  redactSecrets,
} from './security.mjs';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');
const DEFAULT_DIST_DIR = path.join(PROJECT_ROOT, 'dist');

export const DEFAULT_SHOWCASE_PORT = Number(process.env.SHOWCASE_PORT) || 8788;
export const DEFAULT_API_ORIGIN = process.env.API_ORIGIN || 'http://127.0.0.1:8787';

const PRIVATE_LAN_IPV4_REGEX =
  /^(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

const VIRTUAL_ADAPTER_NAME_REGEX =
  /vethernet|wsl|hyper-v|docker|vbox|virtualbox|vmware|loopback|tailscale|zerotier|hamachi|bluetooth/i;

export function isPrivateLanIpv4(ip) {
  if (typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (!PRIVATE_LAN_IPV4_REGEX.test(trimmed)) return false;
  return trimmed.split('.').every((octet) => {
    const n = Number(octet);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

/**
 * Detects active non-internal IPv4 LAN addresses on this machine, prioritizing
 * real Wi-Fi / Ethernet RFC1918 LAN interfaces (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`).
 */
export function detectLanIpv4Addresses() {
  let interfaces = {};
  try {
    interfaces = os.networkInterfaces() || {};
  } catch {
    return [];
  }

  const candidates = [];
  for (const [ifName, entries] of Object.entries(interfaces)) {
    if (!Array.isArray(entries)) continue;
    const isVirtual = VIRTUAL_ADAPTER_NAME_REGEX.test(ifName);
    for (const info of entries) {
      if (!info || info.internal) continue;
      const isV4 = info.family === 'IPv4' || info.family === 4;
      if (!isV4 || typeof info.address !== 'string') continue;
      const addr = info.address.trim();
      if (!addr || addr.startsWith('169.254.') || addr.startsWith('127.')) continue;

      let priority = 50;
      if (isPrivateLanIpv4(addr)) {
        if (addr.startsWith('192.168.')) priority = isVirtual ? 30 : 10;
        else if (addr.startsWith('10.')) priority = isVirtual ? 35 : 15;
        else priority = isVirtual ? 40 : 20;
      } else if (isVirtual) {
        priority = 70;
      }
      candidates.push({ addr, priority });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  const seen = new Set();
  const result = [];
  for (const item of candidates) {
    if (!seen.has(item.addr)) {
      seen.add(item.addr);
      result.push(item.addr);
    }
  }
  return result;
}

function extractIpv4FromHostOrOrigin(rawHeader) {
  if (typeof rawHeader !== 'string' || !rawHeader.trim()) return null;
  const trimmed = rawHeader.trim();
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      return isPrivateLanIpv4(u.hostname) ? u.hostname : null;
    }
  } catch {
    // Fall through to host:port parse
  }
  const hostOnly = trimmed.split('/')[0].split(':')[0];
  return isPrivateLanIpv4(hostOnly) ? hostOnly : null;
}

export function collectLanOriginsForRequest(req, extraLanIps = []) {
  const ips = new Set();
  for (const ip of extraLanIps) {
    if (isPrivateLanIpv4(ip)) ips.add(ip);
  }
  if (req?.headers) {
    for (const h of [req.headers.host, req.headers.origin, req.headers.referer]) {
      const ip = extractIpv4FromHostOrOrigin(Array.isArray(h) ? h[0] : h);
      if (ip) ips.add(ip);
    }
  }
  return Array.from(ips);
}

export function buildDeviceLabCsp(req = null, extraLanIps = []) {
  const lanIps = collectLanOriginsForRequest(req, extraLanIps);
  const lanWildcardPorts = lanIps.map((ip) => `http://${ip}:*`);
  const localAndLanSources = [
    "'self'",
    'http://localhost:*',
    'http://127.0.0.1:*',
    ...lanWildcardPorts,
  ].join(' ');

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src ${localAndLanSources} data: blob: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://tilecache.rainviewer.com`,
    `connect-src ${localAndLanSources} https://api.open-meteo.com https://geocoding-api.open-meteo.com https://air-quality-api.open-meteo.com https://api.rainviewer.com`,
    `frame-src ${localAndLanSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    `frame-ancestors ${localAndLanSources}`,
  ].join('; ');
}

export const DEVICE_LAB_CONTENT_SECURITY_POLICY = buildDeviceLabCsp();

export function buildShowcasePermissionsPolicy(
  apiOrigin = DEFAULT_API_ORIGIN,
  req = null,
  extraLanIps = [],
  ports = [8787, 8788]
) {
  const geoEntries = new Set([
    'self',
    '"http://localhost:8787"',
    '"http://127.0.0.1:8787"',
    '"http://localhost:8788"',
    '"http://127.0.0.1:8788"',
  ]);
  try {
    const origin = new URL(apiOrigin).origin;
    if (/^https?:\/\//i.test(origin)) {
      geoEntries.add(`"${origin}"`);
    }
  } catch {
    // Ignore invalid optional apiOrigin string
  }

  const lanIps = collectLanOriginsForRequest(req, extraLanIps);
  for (const ip of lanIps) {
    for (const p of ports) {
      if (Number.isInteger(p) && p > 0) {
        geoEntries.add(`"http://${ip}:${p}"`);
      }
    }
  }

  return `camera=(), microphone=(), payment=(), geolocation=(${Array.from(geoEntries).join(' ')})`;
}

export function evaluateStudioCorsOrigin(originHeader) {
  const baseCheck = evaluateCorsOrigin(originHeader);
  if (!baseCheck.present || baseCheck.trusted) {
    return baseCheck;
  }
  const normalized = String(originHeader || '').trim();
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' && isPrivateLanIpv4(parsed.hostname)) {
      return { present: true, trusted: true, allowOrigin: normalized, isLanOrigin: true };
    }
  } catch {
    // Untrusted malformed origin
  }
  return baseCheck;
}

const ALLOWED_LAB_EXTENSIONS = new Set([
  '.html',
  '.css',
  '.js',
  '.mjs',
  '.png',
  '.svg',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ico',
  '.json',
  '.webmanifest',
  '.woff',
  '.woff2',
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-encoding',
  'content-type',
  'content-length',
  'if-none-match',
  'origin',
  'x-weatherbuddy-client',
  'x-google-api-key',
  'x-tomorrow-api-key',
  'x-weatherapi-key',
];

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function sendJson(res, statusCode, payload) {
  const buf = Buffer.from(`${JSON.stringify(payload)}\n`, 'utf8');
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', buf.byteLength);
  res.end(buf);
}

function applyShowcaseSecurityHeaders(
  req,
  res,
  {
    isApi = false,
    isHtml = false,
    csp = DEVICE_LAB_CONTENT_SECURITY_POLICY,
    permissionsPolicy = 'camera=(), microphone=(), payment=(), geolocation=(self "http://localhost:8787" "http://127.0.0.1:8787")',
  } = {}
) {
  const originCheck = evaluateStudioCorsOrigin(req.headers.origin);
  if (originCheck.trusted && originCheck.allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', originCheck.allowOrigin);
    res.setHeader('Vary', 'Origin');
  } else if (!originCheck.present && isApi) {
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-WeatherBuddy-Client, X-Google-Api-Key, X-Tomorrow-Api-Key, X-Weatherapi-Key, Accept, Origin'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', permissionsPolicy);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (isHtml) {
    res.setHeader('Content-Security-Policy', csp);
  }

  return originCheck;
}

function resolveContainedFile(baseDir, relativeSubpath) {
  const candidate = path.resolve(baseDir, relativeSubpath);
  const rel = path.relative(baseDir, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return candidate;
}

async function tryServeStaticFile(req, res, filePath, { cacheControl = 'no-cache', htmlCsp = null } = {}) {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return false;

    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const etag = `W/"lab-${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('ETag', etag);
    if (isHtml && htmlCsp) {
      res.setHeader('Content-Security-Policy', htmlCsp);
    }

    const ifNoneMatch = String(req.headers['if-none-match'] || '').trim();
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.statusCode = 304;
      res.end();
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

function augmentDeviceSimCspWithLan(rawCsp, lanIps) {
  if (typeof rawCsp !== 'string' || lanIps.length === 0) return rawCsp;
  const extra = lanIps.map((ip) => `http://${ip}:*`).join(' ');
  return rawCsp
    .replace(
      /frame-ancestors\s+([^;]+)/i,
      (_m, list) => `frame-ancestors ${list} ${extra}`
    )
    .replace(
      /connect-src\s+([^;]+)/i,
      (_m, list) => `connect-src ${list} ${extra}`
    )
    .replace(
      /img-src\s+([^;]+)/i,
      (_m, list) => `img-src ${list} ${extra}`
    );
}

/**
 * Creates the Standalone Separate WeatherBuddy Device Studio Web Server (Port 8788).
 * Accessible on both localhost AND LAN Wi-Fi (`0.0.0.0`), serving `public/device-lab`,
 * `/api/studio-info`, and transparently proxying `/api/*`, `/_expo/*`, `/assets/*`,
 * and `/app-embed` (`/?deviceSim=1`) through port 8788 so mobile phones on Wi-Fi
 * only need port 8788 open.
 */
export function createShowcaseServer(options = {}) {
  const {
    port: defaultPort = DEFAULT_SHOWCASE_PORT,
    host: defaultHost = '127.0.0.1',
    apiOrigin = DEFAULT_API_ORIGIN,
    projectRoot = PROJECT_ROOT,
    distDir = DEFAULT_DIST_DIR,
    proxyTimeoutMs = UPSTREAM_FETCH_TIMEOUT_MS,
  } = options;

  const publicDir = path.join(projectRoot, 'public');
  const publicLabDir = path.join(publicDir, 'device-lab');
  const distLabDir = path.join(distDir, 'device-lab');

  function getActiveShowcasePort() {
    const addr = server.address();
    return typeof addr === 'object' && addr?.port ? addr.port : defaultPort;
  }

  function getBackendPort() {
    try {
      const parsed = new URL(apiOrigin);
      if (parsed.port) return Number(parsed.port);
      return parsed.protocol === 'https:' ? 443 : 80;
    } catch {
      return 8787;
    }
  }

  function buildStudioInfoPayload() {
    const lanIps = detectLanIpv4Addresses();
    const showcasePort = getActiveShowcasePort();
    const backendPort = getBackendPort();
    return {
      status: 'ok',
      service: 'weather-buddy-device-studio',
      showcasePort,
      backendPort,
      lanIps,
      lanUrls: lanIps.map((ip) => `http://${ip}:${showcasePort}`),
      backendLanUrls: lanIps.map((ip) => `http://${ip}:${backendPort}`),
      localStudioUrl: `http://localhost:${showcasePort}`,
      localAppUrl: `http://localhost:${backendPort}`,
      embedPath: '/app-embed',
    };
  }

  function proxyToBackend(req, res, upstreamTargetPath, { isEmbedHtml = false, originCheck = null, lanIps = [] } = {}) {
    let targetUrl;
    try {
      targetUrl = new URL(upstreamTargetPath, apiOrigin);
    } catch {
      sendJson(res, 500, { status: 'error', error: 'Cấu hình apiOrigin không hợp lệ.' });
      return;
    }

    const showcasePort = getActiveShowcasePort();
    const backendPort = getBackendPort();
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const forwardHeaders = {};
    for (const h of FORWARDED_REQUEST_HEADERS) {
      if (req.headers[h] !== undefined) {
        forwardHeaders[h] = req.headers[h];
      }
    }

    // Rewrite trusted LAN Origin header to loopback for upstream mutation CSRF check while echoing LAN CORS back to client
    if (originCheck?.isLanOrigin) {
      forwardHeaders.origin = `http://localhost:${showcasePort}`;
    }

    const upstreamReq = transport.request(
      targetUrl,
      {
        method: req.method || 'GET',
        headers: forwardHeaders,
        timeout: proxyTimeoutMs,
      },
      (upstreamRes) => {
        res.statusCode = upstreamRes.statusCode || 502;
        for (const [key, value] of Object.entries(upstreamRes.headers)) {
          if (value === undefined) continue;
          const lower = key.toLowerCase();
          if (HOP_BY_HOP_HEADERS.has(lower)) continue;
          if (isEmbedHtml && lower === 'x-frame-options') continue;
          if (isEmbedHtml && lower === 'content-security-policy') {
            const rawVal = Array.isArray(value) ? value[0] : String(value);
            res.setHeader(key, augmentDeviceSimCspWithLan(rawVal, lanIps));
            continue;
          }
          res.setHeader(key, value);
        }

        if (originCheck?.trusted && originCheck?.allowOrigin) {
          res.setHeader('Access-Control-Allow-Origin', originCheck.allowOrigin);
          res.setHeader('Vary', 'Origin');
        }
        if (isEmbedHtml) {
          res.removeHeader('X-Frame-Options');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader(
            'Permissions-Policy',
            buildShowcasePermissionsPolicy(apiOrigin, req, lanIps, [backendPort, showcasePort])
          );
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        upstreamRes.pipe(res);
      }
    );

    upstreamReq.on('timeout', () => {
      upstreamReq.destroy(new Error('Upstream API proxy timeout'));
    });

    upstreamReq.on('error', (err) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendJson(res, 502, {
        status: 'error',
        error: `Không thể kết nối tới máy chủ WeatherBuddy gốc (${redactSecrets(String(err?.message || 'proxy error'))}).`,
      });
    });

    req.pipe(upstreamReq);
  }

  const server = http.createServer(async (req, res) => {
    const rawUrl = req.url || '/';
    const detectedLanIps = detectLanIpv4Addresses();
    const requestLanIps = collectLanOriginsForRequest(req, detectedLanIps);
    const dynamicLabCsp = buildDeviceLabCsp(req, requestLanIps);
    const dynamicPermissionsPolicy = buildShowcasePermissionsPolicy(
      apiOrigin,
      req,
      requestLanIps,
      [getBackendPort(), getActiveShowcasePort()]
    );

    const rawPathPart = rawUrl.split('?')[0];
    if (
      rawPathPart.includes('\0') ||
      rawPathPart.includes('\\') ||
      /(?:^|\/)\.\.(?:\/|$)/i.test(rawPathPart) ||
      /%2e%2e/i.test(rawPathPart) ||
      /%5c/i.test(rawPathPart)
    ) {
      applyShowcaseSecurityHeaders(req, res, { permissionsPolicy: dynamicPermissionsPolicy });
      sendJson(res, 403, { status: 'error', error: 'Truy cập đường dẫn bị từ chối.' });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl, 'http://localhost');
    } catch {
      applyShowcaseSecurityHeaders(req, res, {
        isApi: true,
        permissionsPolicy: dynamicPermissionsPolicy,
      });
      sendJson(res, 400, { status: 'error', error: 'URL không hợp lệ.' });
      return;
    }

    const pathname = parsedUrl.pathname;
    const isApi = pathname === '/api' || pathname.startsWith('/api/');

    const originCheck = applyShowcaseSecurityHeaders(req, res, {
      isApi,
      csp: dynamicLabCsp,
      permissionsPolicy: dynamicPermissionsPolicy,
    });

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

    if (pathname === '/api/studio-info' && req.method === 'GET') {
      sendJson(res, 200, buildStudioInfoPayload());
      return;
    }

    if (isApi) {
      proxyToBackend(req, res, rawUrl, { originCheck, lanIps: requestLanIps });
      return;
    }

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

    if (isSuspiciousStaticPath(rawUrl, decodedPathname)) {
      sendJson(res, 403, { status: 'error', error: 'Truy cập đường dẫn bị từ chối.' });
      return;
    }

    // 1. Same-origin /app-embed proxy -> http://127.0.0.1:8787/?deviceSim=1 so LAN phones only need port 8788
    if (decodedPathname === '/app-embed' || decodedPathname === '/app-embed/') {
      const embedParams = new URLSearchParams(parsedUrl.searchParams);
      embedParams.set('deviceSim', '1');
      proxyToBackend(req, res, `/?${embedParams.toString()}`, {
        isEmbedHtml: true,
        originCheck,
        lanIps: requestLanIps,
      });
      return;
    }

    if (decodedPathname.startsWith('/app-embed/')) {
      const strippedSubpath = decodedPathname.slice('/app-embed'.length) || '/';
      proxyToBackend(req, res, `${strippedSubpath}${parsedUrl.search}`, {
        originCheck,
        lanIps: requestLanIps,
      });
      return;
    }

    // 2. Proxy or serve Expo Web bundle & shared static assets (/_expo/*, /assets/*, /downloads/*, /manifest.webmanifest, /pwa-icon.png, /sw.js)
    if (
      decodedPathname.startsWith('/_expo/') ||
      decodedPathname.startsWith('/assets/') ||
      decodedPathname.startsWith('/downloads/') ||
      decodedPathname === '/manifest.webmanifest' ||
      decodedPathname === '/pwa-icon.png' ||
      decodedPathname === '/favicon.ico' ||
      decodedPathname === '/sw.js'
    ) {
      if (decodedPathname === '/favicon.ico' || decodedPathname === '/pwa-icon.png') {
        for (const iconCandidate of [
          path.join(publicDir, 'pwa-icon.png'),
          path.join(distDir, 'pwa-icon.png'),
        ]) {
          if (
            await tryServeStaticFile(req, res, iconCandidate, {
              cacheControl: 'public, max-age=86400',
            })
          ) {
            return;
          }
        }
      }

      if (decodedPathname === '/manifest.webmanifest') {
        for (const manifestCandidate of [
          path.join(distDir, 'manifest.webmanifest'),
          path.join(publicDir, 'manifest.webmanifest'),
        ]) {
          if (await tryServeStaticFile(req, res, manifestCandidate)) {
            return;
          }
        }
      }

      proxyToBackend(req, res, rawUrl, { originCheck, lanIps: requestLanIps });
      return;
    }

    // 3. Serve Device Studio files from public/device-lab (fallback dist/device-lab)
    let subPath = decodedPathname;
    if (subPath === '/device-lab' || subPath === '/device-lab/') {
      subPath = 'index.html';
    } else if (subPath.startsWith('/device-lab/')) {
      subPath = subPath.slice('/device-lab/'.length);
    } else {
      subPath = subPath.replace(/^\/+/, '');
    }

    if (!subPath) {
      subPath = 'index.html';
    }

    const ext = path.extname(subPath).toLowerCase();
    if (ALLOWED_LAB_EXTENSIONS.has(ext)) {
      for (const baseLabDir of [publicLabDir, distLabDir]) {
        const candidate = resolveContainedFile(baseLabDir, subPath);
        if (
          candidate &&
          (await tryServeStaticFile(req, res, candidate, {
            cacheControl: 'no-cache',
            htmlCsp: dynamicLabCsp,
          }))
        ) {
          return;
        }
      }
    }

    if (subPath === 'index.html') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'weather-buddy-device-studio',
        apiOrigin,
        messageVi:
          'WeatherBuddy Device Studio đang khởi động (chờ tài nguyên public/device-lab/index.html).',
      });
      return;
    }

    sendJson(res, 404, { status: 'error', error: 'Không tìm thấy tài nguyên giả lập.' });
  });

  server.getBaseUrl = () => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return `http://localhost:${defaultPort}`;
    }
    const host =
      addr.address === '::' || addr.address === '0.0.0.0' ? '127.0.0.1' : addr.address;
    return `http://${host}:${addr.port}`;
  };

  server.start = (listenPort = defaultPort, listenHost = defaultHost) =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        const addr = server.address();
        const boundPort = typeof addr === 'object' && addr ? addr.port : listenPort;
        resolve({
          port: boundPort,
          host: listenHost,
          baseUrl: server.getBaseUrl(),
        });
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(listenPort, listenHost);
    });

  server.shutdown = async () => {
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

  return server;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const currentModulePath = fileURLToPath(import.meta.url);

if (invokedPath && invokedPath === currentModulePath) {
  const host = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.SHOWCASE_PORT) || 8788;
  const apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:8787';
  const showcaseServer = createShowcaseServer({ port, host, apiOrigin });

  showcaseServer
    .start(port, host)
    .then(({ port: boundPort }) => {
      console.log(
        `[WeatherBuddy Device Studio] Separate Simulator Web running at http://localhost:${boundPort}`
      );
      const lanIps = detectLanIpv4Addresses();
      for (const ip of lanIps) {
        console.log(
          `[WeatherBuddy Device Studio] Mobile & PC LAN Wi-Fi URL: http://${ip}:${boundPort}`
        );
      }
    })
    .catch((err) => {
      console.error(
        '[WeatherBuddy Device Studio] Failed to start:',
        redactSecrets(String(err?.message || err))
      );
      process.exitCode = 1;
    });

  const gracefulExit = async () => {
    try {
      await showcaseServer.shutdown();
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', gracefulExit);
  process.once('SIGTERM', gracefulExit);
}
