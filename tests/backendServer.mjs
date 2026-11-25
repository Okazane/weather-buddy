import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createWeatherBuddyServer } from '../server/index.mjs';
import { createShowcaseServer } from '../server/showcaseServer.mjs';

test('WeatherBuddy Backend Server E2E contract, caching, dashboard, widget-sync, and zero-secret hygiene', async (t) => {
  const server = createWeatherBuddyServer();
  const { port, baseUrl } = await server.start(0, '127.0.0.1');

  t.after(async () => {
    await server.shutdown();
  });

  assert.ok(port > 0, 'Ephemeral port must be assigned');

  await t.test('OPTIONS preflight and GET /api/health return expected CORS, security headers, and metrics', async () => {
    const preflightRes = await fetch(`${baseUrl}/api/weather`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers':
          'Content-Type, X-Google-Api-Key, X-Tomorrow-Api-Key, X-Weatherapi-Key',
      },
    });
    assert.equal(preflightRes.status, 204);
    assert.equal(
      preflightRes.headers.get('access-control-allow-origin'),
      'http://localhost:8081'
    );
    const allowHeaders = (
      preflightRes.headers.get('access-control-allow-headers') || ''
    ).toLowerCase();
    assert.ok(allowHeaders.includes('x-google-api-key'));
    assert.ok(allowHeaders.includes('x-tomorrow-api-key'));
    assert.ok(allowHeaders.includes('x-weatherapi-key'));
    assert.equal(preflightRes.headers.get('x-content-type-options'), 'nosniff');

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();

    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'weather-buddy-backend');
    assert.equal(health.version, '3.0.0');
    assert.equal(health.refreshIntervalMinutes, 15);
    assert.equal(typeof health.uptimeSec, 'number');
    assert.equal(health.cacheSize, 0);
    assert.equal(health.totalRequests, 0);
    assert.equal(health.cacheHits, 0);
  });

  await t.test('GET /api/weather fetches live Open-Meteo snapshot and hits 15-min cache on 2nd call', async () => {
    const query = 'lat=21.0285&lon=105.8542&locationName=H%C3%A0%20N%E1%BB%99i';

    const firstRes = await fetch(`${baseUrl}/api/weather?${query}`);
    assert.equal(firstRes.status, 200);
    const firstBody = await firstRes.json();

    assert.equal(firstBody.cacheHit, false);
    assert.equal(typeof firstBody.latencyMs, 'number');
    assert.ok(firstBody.expiresAtIso, 'expiresAtIso must be returned');
    assert.equal(firstBody.snapshot.locationName, 'Hà Nội');
    assert.equal(firstBody.snapshot.provider, 'open_meteo');
    assert.equal(typeof firstBody.snapshot.temperatureC, 'number');
    assert.ok(Array.isArray(firstBody.snapshot.hourly));
    assert.ok(firstBody.snapshot.hourly.length > 0);
    assert.equal(typeof firstBody.decision.sceneId, 'string');
    assert.equal(typeof firstBody.decision.headlineVi, 'string');

    // Second request to identical coordinates must hit the 15-minute server cache
    const secondRes = await fetch(`${baseUrl}/api/weather?${query}`);
    assert.equal(secondRes.status, 200);
    const secondBody = await secondRes.json();

    assert.equal(secondBody.cacheHit, true);
    assert.equal(secondBody.snapshot.temperatureC, firstBody.snapshot.temperatureC);
    assert.equal(secondBody.expiresAtIso, firstBody.expiresAtIso);

    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    assert.equal(health.cacheSize, 1);
    assert.equal(health.totalRequests, 2);
    assert.equal(health.cacheHits, 1);
  });

  await t.test('API keys in headers or POST body are SHA-256 hashed in cache and never leaked to responses or disk', async () => {
    const sentinelGoogleKey = 'SENTINEL_GOOGLE_SECRET_DO_NOT_LEAK_9012';
    const sentinelTomorrowKey = 'SENTINEL_TOMORROW_SECRET_DO_NOT_LEAK_3456';
    const sentinelWeatherApiKey = 'SENTINEL_WEATHERAPI_SECRET_DO_NOT_LEAK_7890';

    // 1. Auto fallback with transient user keys in headers
    const postRes = await fetch(`${baseUrl}/api/weather`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Google-Api-Key': sentinelGoogleKey,
        'X-Tomorrow-Api-Key': sentinelTomorrowKey,
        'X-Weatherapi-Key': sentinelWeatherApiKey,
      },
      body: JSON.stringify({
        lat: 16.0544,
        lon: 108.2022,
        locationName: 'Đà Nẵng',
        provider: 'auto',
      }),
    });

    assert.equal(postRes.status, 200);
    const rawResponseText = await postRes.text();
    assert.ok(!rawResponseText.includes(sentinelGoogleKey));
    assert.ok(!rawResponseText.includes(sentinelTomorrowKey));
    assert.ok(!rawResponseText.includes(sentinelWeatherApiKey));

    // 2. Verify cache keys only store SHA-256 hashes, never raw keys
    const cacheKeys = server.diagnostics.getCacheKeys();
    assert.ok(cacheKeys.length >= 2);
    for (const ck of cacheKeys) {
      assert.ok(!ck.includes(sentinelGoogleKey), 'Cache key must never contain raw Google key');
      assert.ok(!ck.includes(sentinelTomorrowKey), 'Cache key must never contain raw Tomorrow key');
      assert.ok(!ck.includes(sentinelWeatherApiKey), 'Cache key must never contain raw WeatherAPI key');
    }

    // 3. Verify persisted telemetry.json on disk contains zero secrets
    await server.diagnostics.flushRuntime();
    const telemetryPath = path.join(server.diagnostics.getRuntimeDir(), 'telemetry.json');
    const telemetryDiskRaw = await fs.readFile(telemetryPath, 'utf8');
    assert.ok(!telemetryDiskRaw.includes(sentinelGoogleKey));
    assert.ok(!telemetryDiskRaw.includes(sentinelTomorrowKey));
    assert.ok(!telemetryDiskRaw.includes(sentinelWeatherApiKey));
  });

  await t.test('POST and GET /api/widget-sync persist sanitized WidgetSyncPayload to widget_sync.json', async () => {
    const sampleWidgetPayload = {
      gender: 'female',
      characterNameVi: 'Cô bé Nắng',
      sceneId: 'chilly_cozy',
      locationName: 'Đà Lạt',
      latitude: 11.9404,
      longitude: 108.4583,
      temperatureC: 19,
      feelsLikeC: 18,
      conditionText: 'Se lạnh dễ chịu',
      headlineVi: 'Trời se lạnh',
      outfitAdviceVi: 'Khoác áo mỏng khi ra ngoài',
      badgeVi: '🍂 Trời se lạnh',
      hasRainAheadProp: false,
      rainAheadHours: null,
      hasAqiMask: false,
      skyTheme: 'day_cloudy',
      updatedAtIso: new Date().toISOString(),
      hourlyMini: [
        { hourLabel: '09:00', tempC: 19, precipProbPct: 10 },
        { hourLabel: '10:00', tempC: 20, precipProbPct: 15 },
      ],
      unexpectedSecretField: 'MUST_BE_STRIPPED_BY_SANITIZER',
    };

    const postSyncRes = await fetch(`${baseUrl}/api/widget-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleWidgetPayload),
    });
    assert.equal(postSyncRes.status, 200);
    const postSyncBody = await postSyncRes.json();
    assert.equal(postSyncBody.synced, true);
    assert.equal(postSyncBody.payload.locationName, 'Đà Lạt');
    assert.equal(postSyncBody.payload.sceneId, 'chilly_cozy');
    assert.equal(postSyncBody.payload.unexpectedSecretField, undefined);

    const getSyncRes = await fetch(`${baseUrl}/api/widget-sync`);
    assert.equal(getSyncRes.status, 200);
    const getSyncBody = await getSyncRes.json();
    assert.equal(getSyncBody.synced, true);
    assert.equal(getSyncBody.payload.locationName, 'Đà Lạt');
    assert.equal(getSyncBody.payload.temperatureC, 19);
    assert.equal(getSyncBody.payload.hourlyMini.length, 2);

    const widgetSyncPath = path.join(server.diagnostics.getRuntimeDir(), 'widget_sync.json');
    const widgetDiskRaw = await fs.readFile(widgetSyncPath, 'utf8');
    assert.ok(!widgetDiskRaw.includes('MUST_BE_STRIPPED_BY_SANITIZER'));
  });

  await t.test('GET /api/dashboard/overview aggregates serverHealth, analytics24h, recentTelemetry, and syncedWidget', async () => {
    const dashRes = await fetch(
      `${baseUrl}/api/dashboard/overview?lat=21.0285&lon=105.8542&locationName=H%C3%A0%20N%E1%BB%99i`
    );
    assert.equal(dashRes.status, 200);
    const dash = await dashRes.json();

    assert.equal(dash.status, 'ok');
    assert.equal(dash.cacheHit, true);

    // serverHealth checks
    assert.equal(dash.serverHealth.refreshIntervalMinutes, 15);
    assert.ok(dash.serverHealth.totalRequests >= 4);
    assert.ok(dash.serverHealth.cacheHits >= 2);
    assert.ok(dash.serverHealth.cacheHitRatePct > 0);

    // analytics24h checks
    const a24 = dash.analytics24h;
    assert.ok(a24, 'analytics24h must exist');
    assert.ok(a24.tempMinC <= a24.tempAvgC + 0.1);
    assert.ok(a24.tempMaxC >= a24.tempAvgC - 0.1);
    assert.equal(typeof a24.maxPrecipProbPct, 'number');
    assert.equal(typeof a24.totalPrecipMm, 'number');
    assert.equal(typeof a24.rainHoursCount, 'number');
    assert.equal(typeof a24.comfortIndexVi, 'string');
    assert.ok(a24.comfortIndexVi.length > 5);
    assert.ok(Array.isArray(a24.hourlySeries));
    assert.ok(a24.hourlySeries.length > 0);

    // recentTelemetry checks
    assert.ok(Array.isArray(dash.recentTelemetry));
    assert.ok(dash.recentTelemetry.length >= 3);
    assert.equal(typeof dash.recentTelemetry[0].locationName, 'string');
    assert.equal(typeof dash.recentTelemetry[0].latencyMs, 'number');

    // syncedWidget check
    assert.ok(dash.syncedWidget);
    assert.equal(dash.syncedWidget.locationName, 'Đà Lạt');
  });

  await t.test('GET /api/reverse-geocode resolves Vietnamese city name and caches repeat lookups', async () => {
    const badRes = await fetch(`${baseUrl}/api/reverse-geocode?lat=999&lon=105`);
    assert.equal(badRes.status, 400);

    const geo1Res = await fetch(`${baseUrl}/api/reverse-geocode?lat=21.0285&lon=105.8542`);
    assert.equal(geo1Res.status, 200);
    const geo1 = await geo1Res.json();
    assert.equal(typeof geo1.locationName, 'string');
    assert.ok(geo1.locationName.length > 0);
    assert.equal(geo1.cacheHit, false);

    const geo2Res = await fetch(`${baseUrl}/api/reverse-geocode?lat=21.0285&lon=105.8542`);
    assert.equal(geo2Res.status, 200);
    const geo2 = await geo2Res.json();
    assert.equal(geo2.cacheHit, true);
    assert.equal(geo2.locationName, geo1.locationName);
  });

  await t.test('GET /api/auto-locate returns 200 OK with valid coordinates, Vietnamese locationName, source: ip, security headers, and hits cache on repeat call', async () => {
    const auto1Res = await fetch(`${baseUrl}/api/auto-locate`);
    assert.equal(auto1Res.status, 200);
    assert.equal(auto1Res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(auto1Res.headers.get('x-frame-options'), 'DENY');
    assert.equal(auto1Res.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(auto1Res.headers.get('cache-control'), 'no-store');

    const auto1 = await auto1Res.json();
    assert.equal(auto1.status, 'ok');
    assert.equal(auto1.source, 'ip');
    assert.equal(typeof auto1.latitude, 'number');
    assert.ok(
      Number.isFinite(auto1.latitude) && auto1.latitude >= -90 && auto1.latitude <= 90,
      'latitude must be finite in [-90, 90]'
    );
    assert.equal(typeof auto1.longitude, 'number');
    assert.ok(
      Number.isFinite(auto1.longitude) && auto1.longitude >= -180 && auto1.longitude <= 180,
      'longitude must be finite in [-180, 180]'
    );
    assert.equal(typeof auto1.locationName, 'string');
    assert.ok(auto1.locationName.trim().length > 0, 'locationName must be non-empty');
    assert.equal(auto1.cacheHit, false);

    // Repeat call must hit 15-minute auto-locate cache immediately
    const auto2Res = await fetch(`${baseUrl}/api/auto-locate`);
    assert.equal(auto2Res.status, 200);
    assert.equal(auto2Res.headers.get('x-content-type-options'), 'nosniff');
    const auto2 = await auto2Res.json();
    assert.equal(auto2.status, 'ok');
    assert.equal(auto2.source, 'ip');
    assert.equal(auto2.cacheHit, true);
    assert.equal(auto2.latitude, auto1.latitude);
    assert.equal(auto2.longitude, auto1.longitude);
    assert.equal(auto2.locationName, auto1.locationName);
  });

  await t.test('Static dist/ SPA fallback serves HTML for client routes and 404s missing assets', async () => {
    const rootRes = await fetch(`${baseUrl}/dashboard`);
    assert.equal(rootRes.status, 200);
    const contentType = rootRes.headers.get('content-type') || '';
    assert.ok(
      contentType.includes('text/html') || contentType.includes('application/json')
    );

    const missingAssetRes = await fetch(`${baseUrl}/non-existent-sprite-xyz.png`);
    if (contentType.includes('text/html')) {
      assert.equal(missingAssetRes.status, 404);
    }
  });

  await t.test('GET /api/pc-suite/status returns extension/desktop readiness and download paths', async () => {
    const statusRes = await fetch(`${baseUrl}/api/pc-suite/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();

    assert.equal(statusBody.status, 'ok');
    assert.equal(typeof statusBody.extensionReady, 'boolean');
    assert.equal(typeof statusBody.desktopWidgetReady, 'boolean');
    assert.deepEqual(statusBody.downloads, [
      '/downloads/weather-buddy-extension.zip',
      '/downloads/weather-buddy-desktop-widget.zip',
    ]);
  });

  await t.test('POST /api/pc-widget/launch strictly validates CSRF + enums (zero shell injection) and spawns detached PowerShell safely', async () => {
    // Reject injection attempts on main server instance (with valid CSRF header so enum guard is exercised)
    const injectionRes = await fetch(`${baseUrl}/api/pc-widget/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WeatherBuddy-Client': 'weatherbuddy-ui',
      },
      body: JSON.stringify({
        corner: 'BottomRight; Calc.exe',
        size: 'Standard',
        gender: 'female',
      }),
    });
    assert.equal(injectionRes.status, 400);

    // Test isolated server instance with temporary desktop-widget script + mocked spawnImpl
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-pc-suite-test-'));
    const tmpRuntime = path.join(tmpRoot, '.runtime');
    const tmpDesktopDir = path.join(tmpRoot, 'desktop-widget');
    await fs.mkdir(tmpDesktopDir, { recursive: true });
    const dummyPs1 = path.join(tmpDesktopDir, 'Launch-Desktop-Widget.ps1');
    await fs.writeFile(dummyPs1, '# dummy test script\n', 'utf8');

    const spawnCalls = [];
    const mockServer = createWeatherBuddyServer({
      projectRoot: tmpRoot,
      runtimeDir: tmpRuntime,
      spawnImpl(cmd, args, opts) {
        spawnCalls.push({ cmd, args, opts });
        return { unref() {} };
      },
    });

    const { baseUrl: mockBaseUrl } = await mockServer.start(0, '127.0.0.1');
    try {
      const launchRes = await fetch(`${mockBaseUrl}/api/pc-widget/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WeatherBuddy-Client': 'weatherbuddy-ui',
        },
        body: JSON.stringify({
          corner: 'TopRight',
          size: 'Compact',
          gender: 'male',
        }),
      });

      if (process.platform === 'win32') {
        assert.equal(launchRes.status, 200);
        const launchBody = await launchRes.json();
        assert.equal(launchBody.launched, true);
        assert.equal(launchBody.mode, 'Compact');
        assert.equal(launchBody.corner, 'TopRight');
        assert.equal(launchBody.gender, 'male');

        assert.equal(spawnCalls.length, 1);
        assert.equal(spawnCalls[0].cmd, 'powershell.exe');
        assert.equal(spawnCalls[0].opts.shell, false);
        assert.equal(spawnCalls[0].opts.detached, true);
        assert.ok(spawnCalls[0].args.includes('TopRight'));
        assert.ok(spawnCalls[0].args.includes('Compact'));
        assert.ok(spawnCalls[0].args.includes('male'));
      }
    } finally {
      await mockServer.shutdown();
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  await t.test('Brotli/Gzip compression, ETag 304 Not Modified, SWR revalidation, and GET /api/geocode-search', async () => {
    // 1. Vietnamese diacritic-insensitive geocode search
    const searchRes = await fetch(`${baseUrl}/api/geocode-search?q=hai%20phong&limit=5`);
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.status, 'ok');
    assert.ok(Array.isArray(searchBody.results) && searchBody.results.length >= 1);
    assert.equal(searchBody.results[0].nameVi, 'Hải Phòng');

    // 2. Brotli compression + ETag 304 Not Modified on static bundle
    const tmpDist = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-compress-test-'));
    const tmpRuntime = path.join(tmpDist, '.runtime');
    const sampleJs = `export const DEMO = ${JSON.stringify('weather-buddy-bundle-'.repeat(200))};\n`;
    await fs.writeFile(path.join(tmpDist, 'index.html'), '<!doctype html><html><body>ok</body></html>', 'utf8');
    await fs.mkdir(path.join(tmpDist, '_expo', 'static', 'js', 'web'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDist, '_expo', 'static', 'js', 'web', 'app-test.js'),
      sampleJs,
      'utf8'
    );

    let upstreamCalls = 0;
    const swrServer = createWeatherBuddyServer({
      distDir: tmpDist,
      runtimeDir: tmpRuntime,
      cacheTtlMs: 35,
      staleGraceMs: 5000,
      enableConsensus: false,
      fetchImpl: async (url) => {
        const u = String(url);
        if (u.includes('tile.openstreetmap.org')) {
          return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          });
        }
        if (u.includes('air-quality-api.open-meteo.com')) {
          return new Response(JSON.stringify({ current: { us_aqi: 42, pm2_5: 9.5 } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        upstreamCalls += 1;
        return new Response(
          JSON.stringify({
            utc_offset_seconds: 25200,
            current: {
              time: '2026-11-25T10:00',
              temperature_2m: 26 + upstreamCalls,
              relative_humidity_2m: 68,
              apparent_temperature: 28,
              is_day: 1,
              precipitation: 0,
              precipitation_probability: 10,
              weather_code: 1,
              wind_speed_10m: 11,
              wind_gusts_10m: 16,
              uv_index: 5,
            },
            hourly: {
              time: ['2026-11-25T11:00', '2026-11-25T12:00'],
              temperature_2m: [27, 28],
              relative_humidity_2m: [65, 62],
              precipitation_probability: [10, 15],
              precipitation: [0, 0],
              weather_code: [1, 2],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    const { baseUrl: swrBaseUrl } = await swrServer.start(0, '127.0.0.1');
    try {
      const assetUrl = `${swrBaseUrl}/_expo/static/js/web/app-test.js`;
      const brRes = await fetch(assetUrl, {
        headers: { 'Accept-Encoding': 'br, gzip' },
      });
      assert.equal(brRes.status, 200);
      assert.equal(brRes.headers.get('content-encoding'), 'br');
      assert.equal(brRes.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      const etag = brRes.headers.get('etag');
      assert.ok(etag && etag.startsWith('W/"'));
      const decodedJs = await brRes.text();
      assert.equal(decodedJs, sampleJs);

      const notModRes = await fetch(assetUrl, {
        headers: { 'If-None-Match': etag },
      });
      assert.equal(notModRes.status, 304);

      // 3. Stale-While-Revalidate: 1st call misses -> wait >35ms -> 2nd call returns stale immediately & refreshes in background
      const wUrl = `${swrBaseUrl}/api/weather?lat=10.8231&lon=106.6297&locationName=TP.%20HCM`;
      const firstW = await (await fetch(wUrl)).json();
      assert.equal(firstW.cacheHit, false);
      assert.equal(firstW.snapshot.temperatureC, 27);

      await new Promise((r) => setTimeout(r, 55));
      const secondW = await (await fetch(wUrl)).json();
      assert.equal(secondW.cacheHit, true);
      assert.equal(secondW.staleRevalidating, true);
      assert.equal(secondW.snapshot.temperatureC, 27);

      await new Promise((r) => setTimeout(r, 40));
      const thirdW = await (await fetch(wUrl)).json();
      assert.equal(thirdW.cacheHit, true);
      assert.equal(thirdW.snapshot.temperatureC, 28);

      // 4. Same-origin /api/map-tile PNG proxy + 304 Not Modified
      const badTileRes = await fetch(`${swrBaseUrl}/api/map-tile?z=99&x=0&y=0`);
      assert.equal(badTileRes.status, 400);
      const tileRes = await fetch(`${swrBaseUrl}/api/map-tile?z=7&x=100&y=60`);
      assert.equal(tileRes.status, 200);
      assert.equal(tileRes.headers.get('content-type'), 'image/png');
      const tileEtag = tileRes.headers.get('etag');
      const tile304 = await fetch(`${swrBaseUrl}/api/map-tile?z=7&x=100&y=60`, {
        headers: { 'If-None-Match': tileEtag },
      });
      assert.equal(tile304.status, 304);

      // 5. Device Simulator Iframe Embed Headers: GET / enforces frame-ancestors 'none' & DENY while GET /?deviceSim=1 allows localhost framing
      const normalRootRes = await fetch(`${swrBaseUrl}/`);
      assert.equal(normalRootRes.status, 200);
      assert.equal(normalRootRes.headers.get('x-frame-options'), 'DENY');
      assert.equal(normalRootRes.headers.get('cross-origin-resource-policy'), 'same-origin');
      const normalCsp = normalRootRes.headers.get('content-security-policy') || '';
      assert.ok(normalCsp.includes("frame-ancestors 'none'"));

      const simRootRes = await fetch(`${swrBaseUrl}/?deviceSim=1`);
      assert.equal(simRootRes.status, 200);
      assert.equal(simRootRes.headers.get('x-frame-options'), null);
      assert.equal(simRootRes.headers.get('cross-origin-resource-policy'), 'cross-origin');
      const simCsp = simRootRes.headers.get('content-security-policy') || '';
      assert.ok(!simCsp.includes("frame-ancestors 'none'"));
      assert.ok(
        simCsp.includes("frame-ancestors 'self' http://localhost:* http://127.0.0.1:*")
      );
    } finally {
      await swrServer.shutdown();
      await fs.rm(tmpDist, { recursive: true, force: true });
    }
  });

  await t.test('Device Studio endpoints: GET /?deviceSim=1, GET /api/character-sprite, GET /api/live-preview-bundle, and standalone createShowcaseServer proxy', async () => {
    // 1. Main server GET / vs GET /?deviceSim=1 frame-ancestors isolation
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    assert.equal(rootRes.headers.get('x-frame-options'), 'DENY');
    if ((rootRes.headers.get('content-type') || '').includes('text/html')) {
      assert.ok((rootRes.headers.get('content-security-policy') || '').includes("frame-ancestors 'none'"));
    }

    const simRes = await fetch(`${baseUrl}/?deviceSim=1`);
    assert.equal(simRes.status, 200);
    assert.equal(simRes.headers.get('x-frame-options'), null);
    assert.equal(simRes.headers.get('cross-origin-resource-policy'), 'cross-origin');
    const simPerm = simRes.headers.get('permissions-policy') || '';
    assert.ok(simPerm.includes('"http://localhost:8787"'));
    assert.ok(simPerm.includes('"http://localhost:8788"'));
    const simCsp = simRes.headers.get('content-security-policy') || '';
    assert.ok(!simCsp.includes("frame-ancestors 'none'"));
    assert.ok(simCsp.includes("frame-ancestors 'self' http://localhost:* http://127.0.0.1:*"));

    const favRes = await fetch(`${baseUrl}/favicon.ico`);
    assert.equal(favRes.status, 200);

    const studioInfoMainRes = await fetch(`${baseUrl}/api/studio-info`);
    assert.equal(studioInfoMainRes.status, 200);
    const studioInfoMain = await studioInfoMainRes.json();
    assert.equal(studioInfoMain.status, 'ok');
    assert.ok(Array.isArray(studioInfoMain.lanUrls));
    assert.equal(studioInfoMain.embedPath, '/app-embed');

    // 2. GET /api/character-sprite strict validation + PNG delivery
    const badSpriteRes = await fetch(`${baseUrl}/api/character-sprite?file=../female_pleasant_sunny.png`);
    assert.equal(badSpriteRes.status, 400);

    const badExtRes = await fetch(`${baseUrl}/api/character-sprite?file=shell.js`);
    assert.equal(badExtRes.status, 400);

    const spriteRes = await fetch(`${baseUrl}/api/character-sprite?file=female_pleasant_sunny.png`);
    assert.equal(spriteRes.status, 200);
    assert.equal(spriteRes.headers.get('content-type'), 'image/png');
    assert.equal(spriteRes.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal(spriteRes.headers.get('cache-control'), 'public, max-age=86400');
    const spriteBytes = new Uint8Array(await spriteRes.arrayBuffer());
    assert.ok(spriteBytes.byteLength > 512, 'PNG sprite must have non-trivial payload');
    assert.deepEqual(Array.from(spriteBytes.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);

    const catRes = await fetch(`${baseUrl}/api/character-sprite?file=companion_cat.png`);
    assert.equal(catRes.status, 200);
    assert.equal(catRes.headers.get('content-type'), 'image/png');

    // 3. GET /api/live-preview-bundle preset & live weather modes
    const sunnyRes = await fetch(
      `${baseUrl}/api/live-preview-bundle?scenario=sunny&gender=female`
    );
    assert.equal(sunnyRes.status, 200);
    const sunnyBundle = await sunnyRes.json();
    assert.equal(sunnyBundle.status, 'ok');
    assert.equal(sunnyBundle.snapshot.temperatureC, 27);
    assert.equal(sunnyBundle.decision.sceneId, 'pleasant_sunny');
    assert.equal(typeof sunnyBundle.decision.headlineVi, 'string');
    assert.equal(typeof sunnyBundle.decision.outfitAdviceVi, 'string');
    assert.deepEqual(sunnyBundle.sprites, {
      character: '/api/character-sprite?file=female_pleasant_sunny.png',
      cat: '/api/character-sprite?file=companion_cat.png',
      puppy: '/api/character-sprite?file=companion_puppy.png',
    });

    const stormRes = await fetch(
      `${baseUrl}/api/live-preview-bundle?scenario=storm&gender=male&locationName=%C4%90%C3%A0%20L%E1%BA%A1t&lat=11.9404&lon=108.4583`
    );
    assert.equal(stormRes.status, 200);
    const stormBundle = await stormRes.json();
    assert.equal(stormBundle.status, 'ok');
    assert.equal(stormBundle.snapshot.locationName, 'Đà Lạt');
    assert.equal(stormBundle.decision.sceneId, 'storm_raincoat');
    assert.equal(
      stormBundle.sprites.character,
      '/api/character-sprite?file=male_storm_raincoat.png'
    );

    const nightRes = await fetch(
      `${baseUrl}/api/live-preview-bundle?scenario=clear_night&gender=female`
    );
    assert.equal(nightRes.status, 200);
    const nightBundle = await nightRes.json();
    assert.equal(nightBundle.decision.sceneId, 'clear_night');
    assert.equal(
      nightBundle.sprites.character,
      '/api/character-sprite?file=female_clear_night.png'
    );

    // Live scenario reuses cached Hà Nội snapshot from earlier test
    const liveBundleRes = await fetch(
      `${baseUrl}/api/live-preview-bundle?scenario=live&lat=21.0285&lon=105.8542&locationName=H%C3%A0%20N%E1%BB%99i&gender=female`
    );
    assert.equal(liveBundleRes.status, 200);
    const liveBundle = await liveBundleRes.json();
    assert.equal(liveBundle.status, 'ok');
    assert.equal(liveBundle.cacheHit, true);
    assert.equal(liveBundle.snapshot.locationName, 'Hà Nội');
    assert.ok(liveBundle.sprites.character.startsWith('/api/character-sprite?file=female_'));

    // 4. Standalone Showcase Server (server/showcaseServer.mjs) serves /device-lab and proxies /api/* transparently
    const tmpStudioProject = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-showcase-test-'));
    const tmpLabDir = path.join(tmpStudioProject, 'public', 'device-lab');
    await fs.mkdir(tmpLabDir, { recursive: true });
    await fs.writeFile(
      path.join(tmpLabDir, 'index.html'),
      '<!doctype html><html lang="vi"><head><title>WeatherBuddy Device Studio</title></head><body>studio</body></html>',
      'utf8'
    );
    await fs.writeFile(path.join(tmpLabDir, 'shell.css'), ':root { color-scheme: dark; }\n', 'utf8');

    const showcase = createShowcaseServer({
      port: 0,
      host: '127.0.0.1',
      apiOrigin: baseUrl,
      projectRoot: tmpStudioProject,
    });
    const { baseUrl: showcaseUrl } = await showcase.start(0, '127.0.0.1');
    try {
      const studioHtmlRes = await fetch(`${showcaseUrl}/`);
      assert.equal(studioHtmlRes.status, 200);
      assert.ok((studioHtmlRes.headers.get('content-type') || '').includes('text/html'));
      const studioPerm = studioHtmlRes.headers.get('permissions-policy') || '';
      assert.ok(studioPerm.includes('"http://localhost:8787"'));
      assert.ok(studioPerm.includes(`"${baseUrl}"`));
      const studioCsp = studioHtmlRes.headers.get('content-security-policy') || '';
      assert.ok(studioCsp.includes("frame-src 'self' http://localhost:* http://127.0.0.1:*"));
      const studioHtml = await studioHtmlRes.text();
      assert.ok(studioHtml.includes('WeatherBuddy Device Studio'));

      const studioCssRes = await fetch(`${showcaseUrl}/shell.css`);
      assert.equal(studioCssRes.status, 200);
      assert.ok((studioCssRes.headers.get('content-type') || '').includes('text/css'));

      const proxiedBundleRes = await fetch(
        `${showcaseUrl}/api/live-preview-bundle?scenario=sunny&gender=female`
      );
      assert.equal(proxiedBundleRes.status, 200);
      const proxiedBundle = await proxiedBundleRes.json();
      assert.equal(proxiedBundle.status, 'ok');
      assert.equal(proxiedBundle.decision.sceneId, 'pleasant_sunny');

      const proxiedSpriteRes = await fetch(
        `${showcaseUrl}/api/character-sprite?file=female_pleasant_sunny.png`
      );
      assert.equal(proxiedSpriteRes.status, 200);
      assert.equal(proxiedSpriteRes.headers.get('content-type'), 'image/png');

      // LAN smartphone simulation via Host/Origin headers + /api/studio-info + /app-embed proxy
      const studioInfoRes = await fetch(`${showcaseUrl}/api/studio-info`);
      assert.equal(studioInfoRes.status, 200);
      const studioInfo = await studioInfoRes.json();
      assert.equal(studioInfo.status, 'ok');
      assert.ok(Array.isArray(studioInfo.lanUrls));
      assert.equal(studioInfo.embedPath, '/app-embed');

      const lanStudioRes = await fetch(`${showcaseUrl}/`, {
        headers: { Origin: 'http://192.168.1.77:8788' },
      });
      assert.equal(lanStudioRes.status, 200);
      assert.equal(
        lanStudioRes.headers.get('access-control-allow-origin'),
        'http://192.168.1.77:8788'
      );
      const lanStudioCsp = lanStudioRes.headers.get('content-security-policy') || '';
      assert.ok(lanStudioCsp.includes('http://192.168.1.77:*'));

      const embedProxyRes = await fetch(`${showcaseUrl}/app-embed`, {
        headers: { Origin: 'http://192.168.1.77:8788' },
      });
      assert.equal(embedProxyRes.status, 200);
      assert.equal(embedProxyRes.headers.get('x-frame-options'), null);
      assert.equal(embedProxyRes.headers.get('cross-origin-resource-policy'), 'cross-origin');
      const embedProxyCsp = embedProxyRes.headers.get('content-security-policy') || '';
      assert.ok(!embedProxyCsp.includes("frame-ancestors 'none'"));
      assert.ok(embedProxyCsp.includes('http://192.168.1.77:*'));
    } finally {
      await showcase.shutdown();
      await fs.rm(tmpStudioProject, { recursive: true, force: true });
    }
  });
});
