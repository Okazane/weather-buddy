import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createWeatherBuddyServer } from '../server/index.mjs';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TESTS_DIR, '..');

function sendRawHttpGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: 'GET',
        path: rawPath,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function collectFilesRecursively(dirPath) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.expo' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === '.runtime'
    ) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursively(fullPath);
      results.push(...nested);
    } else if (
      /\.(ts|tsx|js|mjs|cjs|json|html|css|ps1|bat|env|example)$/i.test(entry.name) ||
      entry.name === '.env' ||
      entry.name === '.env.example'
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

test('Enterprise Security Audit Suite — Headers, Path Traversal, Body Cap, Rate Limit, CSRF, Redaction & Secret Scan', async (t) => {
  const tmpRuntime = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-sec-audit-'));
  const server = createWeatherBuddyServer({
    runtimeDir: tmpRuntime,
    rateLimits: {
      weather: { windowMs: 60_000, max: 60 },
      pcWidgetLaunch: { windowMs: 60_000, max: 4 },
      defaultApi: { windowMs: 60_000, max: 120 },
    },
  });

  const { port, baseUrl } = await server.start(0, '127.0.0.1');

  t.after(async () => {
    await server.shutdown();
    await fs.rm(tmpRuntime, { recursive: true, force: true });
  });

  await t.test('1. Path traversal (/../.env, /%2e%2e/.env, /.env) is strictly blocked with 403', async () => {
    // Raw unnormalized HTTP path traversal attempt
    const rawTraversal = await sendRawHttpGet(port, '/../.env');
    assert.equal(rawTraversal.statusCode, 403);
    assert.ok(!rawTraversal.body.includes('EXPO_PUBLIC_'));

    // URL-encoded traversal attempt
    const encodedTraversal = await sendRawHttpGet(port, '/%2e%2e/.env');
    assert.equal(encodedTraversal.statusCode, 403);
    assert.ok(!encodedTraversal.body.includes('EXPO_PUBLIC_'));

    // Normalized dotfile fetch attempt (`fetch()` normalizes `/../.env` -> `/.env`)
    const dotfileFetch = await fetch(`${baseUrl}/../.env`);
    assert.equal(dotfileFetch.status, 403);
    const dotfileBody = await dotfileFetch.text();
    assert.ok(!dotfileBody.includes('EXPO_PUBLIC_'));
  });

  await t.test('2. Oversized >16KB POST payload is rejected with 413 Payload Too Large', async () => {
    const oversizedPayload = JSON.stringify({
      locationName: 'Hà Nội',
      padding: 'A'.repeat(18 * 1024),
    });

    const res = await fetch(`${baseUrl}/api/widget-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WeatherBuddy-Client': 'weatherbuddy-ui',
      },
      body: oversizedPayload,
    });

    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.status, 'error');
  });

  await t.test('3. Invalid coordinates (lat=999, lon=-250) and invalid providers are rejected with 400', async () => {
    const badLatRes = await fetch(`${baseUrl}/api/weather?lat=999&lon=105.85`);
    assert.equal(badLatRes.status, 400);

    const badLonRes = await fetch(`${baseUrl}/api/reverse-geocode?lat=21.02&lon=-250`);
    assert.equal(badLonRes.status, 400);

    const badProviderRes = await fetch(
      `${baseUrl}/api/weather?lat=21.0285&lon=105.8542&provider=malicious_provider`
    );
    assert.equal(badProviderRes.status, 400);
  });

  await t.test('4. POST /api/pc-widget/launch rejects missing CSRF header (403), untrusted Origin (403), and enforces rate limiting (429)', async () => {
    // Missing X-WeatherBuddy-Client CSRF header -> 403
    const noCsrfRes = await fetch(`${baseUrl}/api/pc-widget/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corner: 'BottomRight', size: 'Standard', gender: 'female' }),
    });
    assert.equal(noCsrfRes.status, 403);

    // Untrusted cross-site Origin -> 403
    const evilOriginRes = await fetch(`${baseUrl}/api/widget-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil-attacker.example.com',
        'X-WeatherBuddy-Client': 'weatherbuddy-ui',
      },
      body: JSON.stringify({ locationName: 'Hà Nội', temperatureC: 25 }),
    });
    assert.equal(evilOriginRes.status, 403);

    // Exhaust pcWidgetLaunch bucket (configured max: 4/min on this audit instance; 1 already consumed above)
    for (let i = 0; i < 3; i += 1) {
      await fetch(`${baseUrl}/api/pc-widget/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    }

    const rateLimitedRes = await fetch(`${baseUrl}/api/pc-widget/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WeatherBuddy-Client': 'weatherbuddy-ui',
      },
      body: '{}',
    });
    assert.equal(rateLimitedRes.status, 429);
    assert.equal(rateLimitedRes.headers.get('x-ratelimit-remaining'), '0');
    assert.ok(Number(rateLimitedRes.headers.get('retry-after')) >= 1);
  });

  await t.test('5. Security headers (nosniff, DENY, no-referrer, Permissions-Policy, CORP, CSP) and /api/security/status are enforced', async () => {
    const secRes = await fetch(`${baseUrl}/api/security/status`, {
      headers: { Origin: 'http://localhost:8081' },
    });
    assert.equal(secRes.status, 200);
    assert.equal(secRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(secRes.headers.get('x-frame-options'), 'DENY');
    assert.equal(secRes.headers.get('referrer-policy'), 'no-referrer');
    assert.ok(
      (secRes.headers.get('permissions-policy') || '').includes('camera=()')
    );
    assert.equal(secRes.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal(
      secRes.headers.get('access-control-allow-origin'),
      'http://localhost:8081'
    );

    const secBody = await secRes.json();
    assert.equal(secBody.rateLimitActive, true);
    assert.equal(secBody.csrfProtected, true);
    assert.equal(secBody.keyRedaction, true);
    assert.equal(secBody.headersHardened, true);
    assert.equal(secBody.loopbackGuardOnLaunch, true);

    // Check HTML CSP header when dist/index.html is served
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    if ((htmlRes.headers.get('content-type') || '').includes('text/html')) {
      const csp = htmlRes.headers.get('content-security-policy') || '';
      assert.ok(csp.includes("object-src 'none'"));
      assert.ok(csp.includes("frame-ancestors 'none'"));
      assert.equal(htmlRes.headers.get('cross-origin-resource-policy'), 'same-origin');
    }
  });

  await t.test('6. Upstream error URLs containing ?apikey=SECRET123 or AIza... tokens are scrubbed before reaching client', async () => {
    const dummyGoogleToken = ['AIza', 'SyDummyRedactionTest987654321'].join('');
    const errRuntime = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-redact-test-'));
    const failingServer = createWeatherBuddyServer({
      runtimeDir: errRuntime,
      fetchImpl: async () => {
        throw new Error(
          `Upstream request to https://api.tomorrow.io/v4/weather/realtime?location=21,105&apikey=SECRET123 and googleKey=${dummyGoogleToken} failed`
        );
      },
    });

    const { baseUrl: failBaseUrl } = await failingServer.start(0, '127.0.0.1');
    try {
      const res = await fetch(
        `${failBaseUrl}/api/weather?lat=21.0285&lon=105.8542&provider=tomorrow_io`,
        {
          headers: {
            'X-Tomorrow-Api-Key': 'SECRET123',
          },
        }
      );
      assert.equal(res.status, 500);
      const text = await res.text();
      assert.ok(!text.includes('SECRET123'), 'Raw apikey query secret must be redacted');
      assert.ok(
        !text.includes(dummyGoogleToken),
        'Google AIza token must be redacted'
      );
      assert.ok(text.includes('[REDACTED'));
    } finally {
      await failingServer.shutdown();
      await fs.rm(errRuntime, { recursive: true, force: true });
    }
  });

  await t.test('7. Repository-wide secret scan confirms ZERO hardcoded API keys in src/, server/, browser-extension/, desktop-widget/, and .env', async () => {
    const scanTargets = [
      path.join(PROJECT_ROOT, 'src'),
      path.join(PROJECT_ROOT, 'server'),
      path.join(PROJECT_ROOT, 'browser-extension'),
      path.join(PROJECT_ROOT, 'desktop-widget'),
    ];

    const filesToScan = [];
    for (const dir of scanTargets) {
      const found = await collectFilesRecursively(dir);
      filesToScan.push(...found);
    }

    const envPath = path.join(PROJECT_ROOT, '.env');
    try {
      await fs.access(envPath);
      filesToScan.push(envPath);
    } catch {
      // .env is optional
    }

    assert.ok(filesToScan.length >= 10, 'Must scan project source files');

    // Patterns representing real leaked credentials
    const googleApiKeyRegex = /\bAIza[0-9A-Za-z_-]{31,39}\b/;
    const envLineRegex =
      /^[ \t]*EXPO_PUBLIC_(?:TOMORROW_API_KEY|WEATHERAPI_KEY|GOOGLE_WEATHER_API_KEY)[ \t]*=[ \t]*([^\r\n#]*)/gm;

    for (const filePath of filesToScan) {
      const content = await fs.readFile(filePath, 'utf8');
      const relPath = path.relative(PROJECT_ROOT, filePath);

      assert.equal(
        googleApiKeyRegex.test(content),
        false,
        `Hardcoded Google API key pattern detected in ${relPath}`
      );

      for (const match of content.matchAll(envLineRegex)) {
        const assignedVal = match[1].replace(/^["']|["']$/g, '').trim();
        assert.equal(
          assignedVal,
          '',
          `Non-empty API key value configured in ${relPath}`
        );
      }
    }
  });
});
