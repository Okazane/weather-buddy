import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createWeatherBuddyServer } from '../server/index.mjs';

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
});
