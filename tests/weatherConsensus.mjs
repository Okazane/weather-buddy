import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (
        (specifier.startsWith('./') || specifier.startsWith('../')) &&
        !/\.[a-z0-9]+$/i.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') || url.endsWith('.tsx')) {
      return nextLoad(url, { ...context, format: 'module-typescript' });
    }
    return nextLoad(url, context);
  },
});

const core = await import('../src/core/index.ts');
const { createWeatherBuddyServer } = await import('../server/index.mjs');

const {
  VIETNAM_METAR_STATIONS,
  WEATHER_CONSENSUS_USER_AGENT,
  haversineDistanceKm,
  findNearestMetarStation,
  computeMagnusHumidityPct,
  parseMetarPayload,
  parseMetNorwayPayload,
  reconcileWeatherConsensus,
  fetchWeatherSnapshot,
} = core;

const FIXED_NOW_MS = Date.parse('2026-11-24T08:00:00.000Z');

function makeOpenMeteoSnapshot(overrides = {}) {
  return {
    provider: 'open_meteo',
    locationName: 'TP. Hồ Chí Minh',
    latitude: 10.8231,
    longitude: 106.6297,
    updatedAtIso: '2026-11-24T15:00:00+07:00',
    utcOffsetSeconds: 25200,
    temperatureC: 32.0,
    feelsLikeC: 35.0,
    humidityPct: 68,
    windSpeedKmh: 11.0,
    windGustKmh: 17.0,
    uvIndex: 6.0,
    precipMmPerHr: 0.4,
    precipProbPct: 62,
    conditionText: 'Mưa phùn lất phất',
    isDay: true,
    aqi: 45,
    hourly: [
      {
        timeIso: '2026-11-24T16:00:00+07:00',
        temperatureC: 31.5,
        precipProbPct: 30,
        precipMm: 0.1,
        conditionCode: 'PARTLY_CLOUDY',
      },
    ],
    ...overrides,
  };
}

test('VIETNAM_METAR_STATIONS lookup resolves major airports within 45 km and returns null for remote mountain towns', () => {
  assert.ok(VIETNAM_METAR_STATIONS.length >= 18);

  const hcmc = findNearestMetarStation(10.8231, 106.6297);
  assert.ok(hcmc);
  assert.equal(hcmc.icao, 'VVTS');
  assert.ok(hcmc.distanceKm < 5);

  const hanoi = findNearestMetarStation(21.0285, 105.8542);
  assert.ok(hanoi);
  assert.equal(hanoi.icao, 'VVNB');
  assert.ok(hanoi.distanceKm >= 18 && hanoi.distanceKm <= 26);

  const danang = findNearestMetarStation(16.0544, 108.2022);
  assert.ok(danang);
  assert.equal(danang.icao, 'VVDN');
  assert.ok(danang.distanceKm < 5);

  const dalat = findNearestMetarStation(11.9404, 108.4583);
  assert.ok(dalat);
  assert.equal(dalat.icao, 'VVDL');
  assert.ok(dalat.distanceKm >= 20 && dalat.distanceKm <= 30);

  // Sa Pa has no airport within 45 km
  const sapa = findNearestMetarStation(22.3364, 103.8438);
  assert.equal(sapa, null);

  // Haversine self-distance is 0
  assert.equal(haversineDistanceKm(10.8188, 106.6519, 10.8188, 106.6519), 0);
});

test('computeMagnusHumidityPct accurately derives relative humidity from temperature and dewpoint', () => {
  assert.equal(computeMagnusHumidityPct(30, 30), 100);
  const humid = computeMagnusHumidityPct(29, 26);
  assert.ok(humid >= 82 && humid <= 86, `Expected ~84%, got ${humid}`);
  const dry = computeMagnusHumidityPct(32, 18);
  assert.ok(dry >= 41 && dry <= 45, `Expected ~43%, got ${dry}`);
});

test('Rule 1a: suppresses false-positive Open-Meteo drizzle when fresh METAR and MET Norway agree dry', () => {
  const snap = makeOpenMeteoSnapshot({
    precipMmPerHr: 0.9,
    precipProbPct: 68,
    conditionText: 'Mưa nhỏ rải rác',
  });

  const reconciled = reconcileWeatherConsensus(
    snap,
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 6.2,
        observedAtIso: '2026-11-24T07:30:00.000Z',
        ageMinutes: 30,
        tempC: 30.0,
        dewpointC: 25.0,
        humidityPct: 75,
        cloudCover: 'SCT',
      },
      metNorway: {
        observedAtIso: '2026-11-24T08:00:00Z',
        tempC: 31.2,
        humidityPct: 70,
        symbolCode: 'partlycloudy_day',
        precipNext1hMm: 0.0,
      },
    },
    { nowMs: FIXED_NOW_MS }
  );

  assert.equal(reconciled.precipMmPerHr, 0);
  assert.equal(reconciled.precipProbPct, 35);
  assert.equal(reconciled.conditionText, 'Có mây rải rác');
  assert.ok(reconciled.verification);
  assert.equal(reconciled.verification.consensusLevel, 'verified_multi_source');
  assert.equal(reconciled.verification.reconciledRainAdjusted, true);
  assert.equal(reconciled.verification.metarStationIcao, 'VVTS');
  assert.equal(reconciled.verification.metNoSymbolCode, 'partlycloudy_day');
  assert.equal(reconciled.verification.metNoPrecipMm, 0);
  assert.match(reconciled.verification.summaryVi, /3 nguồn.*Open-Meteo.*VVTS.*MET Norway/);
});

test('Rule 1b & 1c: close dry METAR (<25km) suppresses <=0.6mm/h drizzle alone, while confirmed rain is preserved', () => {
  const nightDrizzle = makeOpenMeteoSnapshot({
    precipMmPerHr: 0.5,
    precipProbPct: 55,
    conditionText: 'Mưa phùn lất phất',
    isDay: false,
  });

  const suppressedNight = reconcileWeatherConsensus(
    nightDrizzle,
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 8.5,
        observedAtIso: '2026-11-24T07:45:00.000Z',
        ageMinutes: 15,
        cloudCover: 'FEW',
      },
      metNorway: null,
    },
    { nowMs: FIXED_NOW_MS }
  );

  assert.equal(suppressedNight.precipMmPerHr, 0);
  assert.equal(suppressedNight.precipProbPct, 35);
  assert.equal(suppressedNight.conditionText, 'Đêm quang đãng');
  assert.equal(suppressedNight.verification?.reconciledRainAdjusted, true);

  // When METAR actually reports rain (-RA), drizzle must NOT be suppressed
  const confirmedRain = reconcileWeatherConsensus(
    makeOpenMeteoSnapshot({ precipMmPerHr: 0.4, precipProbPct: 60 }),
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 6.0,
        ageMinutes: 15,
        wxString: '-RA',
        cloudCover: 'OVC',
      },
      metNorway: { precipNext1hMm: 0.0, symbolCode: 'cloudy' },
    },
    { nowMs: FIXED_NOW_MS }
  );

  assert.equal(confirmedRain.precipMmPerHr, 0.4);
  assert.equal(confirmedRain.verification?.reconciledRainAdjusted, undefined);
});

test('Rule 2: real-time nearby METAR thunderstorm / heavy rain / light rain overrides dry grid model; stale METAR does not', () => {
  const drySnap = makeOpenMeteoSnapshot({
    precipMmPerHr: 0,
    precipProbPct: 18,
    conditionText: 'Có mây rải rác',
  });

  // Thunderstorm (+TSRA)
  const storm = reconcileWeatherConsensus(
    drySnap,
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 7.4,
        ageMinutes: 12,
        wxString: '+TSRA',
        cloudCover: 'OVC',
      },
      metNorway: null,
    },
    { nowMs: FIXED_NOW_MS }
  );
  assert.equal(storm.precipMmPerHr, 6.0);
  assert.equal(storm.precipProbPct, 88);
  assert.equal(storm.conditionText, 'Mưa dông kèm gió giật');
  assert.equal(storm.verification?.reconciledRainAdjusted, true);

  // Heavy rain (+RA without TS)
  const heavy = reconcileWeatherConsensus(
    drySnap,
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 7.4,
        ageMinutes: 12,
        wxString: '+RA',
        cloudCover: 'OVC',
      },
      metNorway: null,
    },
    { nowMs: FIXED_NOW_MS }
  );
  assert.equal(heavy.precipMmPerHr, 6.0);
  assert.equal(heavy.conditionText, 'Mưa to nặng hạt');

  // Light rain (-RA / SHRA / DZ)
  const light = reconcileWeatherConsensus(
    drySnap,
    {
      metar: {
        stationIcao: 'VVDN',
        stationNameVi: 'Sân bay Đà Nẵng',
        distanceKm: 4.1,
        ageMinutes: 20,
        wxString: '-SHRA',
        cloudCover: 'BKN',
      },
      metNorway: null,
    },
    { nowMs: FIXED_NOW_MS }
  );
  assert.equal(light.precipMmPerHr, 1.2);
  assert.equal(light.precipProbPct, 72);
  assert.equal(light.conditionText, 'Mưa nhỏ rải rác');
  assert.equal(light.verification?.reconciledRainAdjusted, true);

  // Stale METAR (> 75 min old) must NOT override dry forecast
  const stale = reconcileWeatherConsensus(
    drySnap,
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 5.0,
        ageMinutes: 85,
        wxString: '+TSRA',
      },
      metNorway: null,
    },
    { nowMs: FIXED_NOW_MS }
  );
  assert.equal(stale.precipMmPerHr, 0);
  assert.equal(stale.verification?.reconciledRainAdjusted, undefined);
});

test('Rule 3: physical thermometer/humidity calibration blends 65% METAR (clamped +-3C) or falls back to 35% MET Norway', () => {
  // Case A: METAR within normal delta -> 65% METAR + 35% model
  const snapA = makeOpenMeteoSnapshot({
    temperatureC: 32.0,
    feelsLikeC: 35.0,
    humidityPct: 60,
    precipMmPerHr: 0,
    conditionText: 'Có mây rải rác',
  });
  const calibratedA = reconcileWeatherConsensus(
    snapA,
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 6.0,
        ageMinutes: 20,
        tempC: 30.0,
        humidityPct: 80,
      },
      metNorway: null,
    },
    { nowMs: FIXED_NOW_MS }
  );
  // 0.80 * 30 + 0.20 * 32 = 30.4 (-1.6 delta for close-range <=18km station)
  assert.equal(calibratedA.temperatureC, 30.4);
  assert.equal(calibratedA.feelsLikeC, 33.4);
  // 0.65 * 80 + 0.35 * 60 = 73
  assert.equal(calibratedA.humidityPct, 73);

  // Case B: Bogus/extreme METAR outlier is clamped to max +-5.5C shift for <=18km station
  const clampedB = reconcileWeatherConsensus(
    snapA,
    {
      metar: {
        stationIcao: 'VVTS',
        stationNameVi: 'Sân bay Tân Sơn Nhất, TP.HCM',
        distanceKm: 6.0,
        ageMinutes: 10,
        tempC: 20.0, // -12C outlier
      },
      metNorway: null,
    },
    { nowMs: FIXED_NOW_MS }
  );
  assert.equal(clampedB.temperatureC, 26.5);
  assert.equal(clampedB.feelsLikeC, 29.5);

  // Case C: No METAR (e.g., Sa Pa) -> blends 65% Open-Meteo + 35% MET Norway when |diff| <= 4C
  const sapaSnap = makeOpenMeteoSnapshot({
    locationName: 'Sa Pa',
    latitude: 22.3364,
    longitude: 103.8438,
    temperatureC: 14.0,
    feelsLikeC: 13.0,
    humidityPct: 80,
    precipMmPerHr: 0,
    conditionText: 'Trời nhiều mây',
  });
  const modelBlend = reconcileWeatherConsensus(
    sapaSnap,
    {
      metar: null,
      metNorway: {
        observedAtIso: '2026-11-24T08:00:00Z',
        tempC: 16.0,
        humidityPct: 70,
        symbolCode: 'cloudy',
        precipNext1hMm: 0,
      },
    },
    { nowMs: FIXED_NOW_MS }
  );
  // 0.65 * 14 + 0.35 * 16 = 14.7 (+0.7 delta)
  assert.equal(modelBlend.temperatureC, 14.7);
  assert.equal(modelBlend.feelsLikeC, 13.7);
  assert.equal(modelBlend.verification?.consensusLevel, 'model_consensus');
  assert.equal(modelBlend.verification?.summaryVi, 'Đã đối chiếu Open-Meteo & MET Norway');
});

test('parseMetarPayload and parseMetNorwayPayload handle real aviationweather.gov and api.met.no JSON structures', () => {
  const station = VIETNAM_METAR_STATIONS[0];
  const parsedMetar = parseMetarPayload(
    [
      {
        icaoId: 'VVTS',
        reportTime: '2026-11-24T07:30:00.000Z',
        temp: 29,
        dewp: 26,
        wspd: 5,
        cover: 'SCT',
        rawOb: 'METAR VVTS 240730Z 26005KT 9999 SCT048 29/26 Q1010 NOSIG',
      },
    ],
    station,
    6.2,
    FIXED_NOW_MS
  );
  assert.ok(parsedMetar);
  assert.equal(parsedMetar.stationIcao, 'VVTS');
  assert.equal(parsedMetar.ageMinutes, 30);
  assert.equal(parsedMetar.tempC, 29);
  assert.equal(parsedMetar.cloudCover, 'SCT');
  assert.ok(parsedMetar.humidityPct >= 82 && parsedMetar.humidityPct <= 86);

  const parsedMetNo = parseMetNorwayPayload(
    {
      properties: {
        timeseries: [
          {
            time: '2026-11-24T07:00:00Z',
            data: {
              instant: { details: { air_temperature: 30.1, relative_humidity: 70 } },
              next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0.4 } },
            },
          },
          {
            time: '2026-11-24T08:00:00Z',
            data: {
              instant: { details: { air_temperature: 31.5, relative_humidity: 64 } },
              next_1_hours: { summary: { symbol_code: 'fair_day' }, details: { precipitation_amount: 0.0 } },
            },
          },
        ],
      },
    },
    FIXED_NOW_MS
  );
  assert.ok(parsedMetNo);
  assert.equal(parsedMetNo.observedAtIso, '2026-11-24T08:00:00Z');
  assert.equal(parsedMetNo.tempC, 31.5);
  assert.equal(parsedMetNo.symbolCode, 'fair_day');
  assert.equal(parsedMetNo.precipNext1hMm, 0);
});

test('fetchWeatherSnapshot respects backward compatibility with custom mockFetch and runs full consensus when enableConsensus: true', async () => {
  const calledUrls = [];
  let metNoUserAgent = '';

  const multiMockFetch = async (url, init) => {
    const str = String(url);
    calledUrls.push(str);

    if (str.includes('air-quality-api.open-meteo.com')) {
      return new Response(JSON.stringify({ current: { us_aqi: 44 } }), { status: 200 });
    }
    if (str.includes('api.open-meteo.com')) {
      return new Response(
        JSON.stringify({
          utc_offset_seconds: 25200,
          current: {
            time: '2026-11-24T15:00',
            temperature_2m: 32.0,
            relative_humidity_2m: 68,
            apparent_temperature: 35.0,
            is_day: 1,
            precipitation: 0.4,
            precipitation_probability: 65,
            weather_code: 51,
            wind_speed_10m: 11,
            wind_gusts_10m: 17,
            uv_index: 6,
          },
          minutely_15: { precipitation: [0.1, 0.1] },
          hourly: {
            time: ['2026-11-24T16:00'],
            temperature_2m: [31.5],
            precipitation_probability: [25],
            precipitation: [0],
            weather_code: [2],
          },
        }),
        { status: 200 }
      );
    }
    if (str.includes('aviationweather.gov/api/data/metar')) {
      return new Response(
        JSON.stringify([
          {
            icaoId: 'VVTS',
            reportTime: new Date(Date.now() - 15 * 60_000).toISOString(),
            temp: 30,
            dewp: 25,
            wspd: 6,
            cover: 'SCT',
          },
        ]),
        { status: 200 }
      );
    }
    if (str.includes('api.met.no/weatherapi/locationforecast')) {
      metNoUserAgent = String(init?.headers?.['User-Agent'] ?? '');
      return new Response(
        JSON.stringify({
          properties: {
            timeseries: [
              {
                time: new Date().toISOString(),
                data: {
                  instant: { details: { air_temperature: 31.0, relative_humidity: 66 } },
                  next_1_hours: {
                    summary: { symbol_code: 'partlycloudy_day' },
                    details: { precipitation_amount: 0.0 },
                  },
                },
              },
            ],
          },
        }),
        { status: 200 }
      );
    }

    return new Response('Not Found', { status: 404 });
  };

  // 1. Custom mockFetch WITHOUT enableConsensus -> zero unexpected METAR/MET Norway calls
  const legacySnap = await fetchWeatherSnapshot({
    latitude: 10.8231,
    longitude: 106.6297,
    locationName: 'TP. Hồ Chí Minh',
    provider: 'open_meteo',
    fetchImpl: multiMockFetch,
  });
  assert.equal(legacySnap.precipMmPerHr, 0.4);
  assert.equal(legacySnap.verification, undefined);
  assert.ok(!calledUrls.some((u) => u.includes('aviationweather.gov')));
  assert.ok(!calledUrls.some((u) => u.includes('api.met.no')));

  // 2. With enableConsensus: true -> queries METAR + MET Norway with proper User-Agent and reconciles drizzle
  calledUrls.length = 0;
  const verifiedSnap = await fetchWeatherSnapshot({
    latitude: 10.8231,
    longitude: 106.6297,
    locationName: 'TP. Hồ Chí Minh',
    provider: 'open_meteo',
    fetchImpl: multiMockFetch,
    enableConsensus: true,
  });
  assert.equal(metNoUserAgent, WEATHER_CONSENSUS_USER_AGENT);
  assert.ok(calledUrls.some((u) => u.includes('aviationweather.gov/api/data/metar?ids=VVTS')));
  assert.ok(calledUrls.some((u) => u.includes('api.met.no/weatherapi/locationforecast')));
  assert.equal(verifiedSnap.precipMmPerHr, 0);
  assert.equal(verifiedSnap.conditionText, 'Có mây rải rác');
  assert.equal(verifiedSnap.verification?.consensusLevel, 'verified_multi_source');
  assert.equal(verifiedSnap.verification?.reconciledRainAdjusted, true);
});

test('Node server GET /api/weather-verify validates coordinates, caches for 5 minutes, and enriches GET /api/weather', async (t) => {
  const tmpRuntime = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-verify-test-'));
  let metarCalls = 0;
  let metNoCalls = 0;

  const mockServerFetch = async (url) => {
    const str = String(url);
    if (str.includes('air-quality-api.open-meteo.com')) {
      return new Response(JSON.stringify({ current: { us_aqi: 52 } }), { status: 200 });
    }
    if (str.includes('api.open-meteo.com')) {
      return new Response(
        JSON.stringify({
          utc_offset_seconds: 25200,
          current: {
            time: '2026-11-24T15:00',
            temperature_2m: 31.5,
            relative_humidity_2m: 70,
            apparent_temperature: 34.0,
            is_day: 1,
            precipitation: 0.3,
            precipitation_probability: 58,
            weather_code: 51,
            wind_speed_10m: 9,
            wind_gusts_10m: 15,
            uv_index: 5,
          },
          hourly: {
            time: ['2026-11-24T16:00'],
            temperature_2m: [31.0],
            precipitation_probability: [20],
            precipitation: [0],
            weather_code: [2],
          },
        }),
        { status: 200 }
      );
    }
    if (str.includes('aviationweather.gov')) {
      metarCalls += 1;
      return new Response(
        JSON.stringify([
          {
            icaoId: 'VVTS',
            reportTime: new Date(Date.now() - 10 * 60_000).toISOString(),
            temp: 30,
            dewp: 24,
            wspd: 5,
            cover: 'FEW',
          },
        ]),
        { status: 200 }
      );
    }
    if (str.includes('api.met.no')) {
      metNoCalls += 1;
      return new Response(
        JSON.stringify({
          properties: {
            timeseries: [
              {
                time: new Date().toISOString(),
                data: {
                  instant: { details: { air_temperature: 30.8, relative_humidity: 65 } },
                  next_1_hours: {
                    summary: { symbol_code: 'fair_day' },
                    details: { precipitation_amount: 0.0 },
                  },
                },
              },
            ],
          },
        }),
        { status: 200 }
      );
    }
    return new Response('Not Found', { status: 404 });
  };

  const server = createWeatherBuddyServer({
    runtimeDir: tmpRuntime,
    fetchImpl: mockServerFetch,
  });
  const { baseUrl } = await server.start(0, '127.0.0.1');

  t.after(async () => {
    await server.shutdown();
    await fs.rm(tmpRuntime, { recursive: true, force: true });
  });

  // Invalid coords -> 400
  const badRes = await fetch(`${baseUrl}/api/weather-verify?lat=999&lon=106`);
  assert.equal(badRes.status, 400);

  // First verify call -> misses cache
  const v1Res = await fetch(`${baseUrl}/api/weather-verify?lat=10.8231&lon=106.6297`);
  assert.equal(v1Res.status, 200);
  const v1 = await v1Res.json();
  assert.equal(v1.status, 'ok');
  assert.equal(v1.cacheHit, false);
  assert.equal(v1.metar?.stationIcao, 'VVTS');
  assert.equal(v1.metNorway?.symbolCode, 'fair_day');
  assert.equal(metarCalls, 1);
  assert.equal(metNoCalls, 1);

  // Second verify call -> hits 5-minute cache
  const v2Res = await fetch(`${baseUrl}/api/weather-verify?lat=10.8231&lon=106.6297`);
  assert.equal(v2Res.status, 200);
  const v2 = await v2Res.json();
  assert.equal(v2.cacheHit, true);
  assert.equal(metarCalls, 1);
  assert.equal(metNoCalls, 1);

  // GET /api/weather reuses the 5-minute verification cache and suppresses false drizzle
  const wRes = await fetch(
    `${baseUrl}/api/weather?lat=10.8231&lon=106.6297&locationName=TP.%20H%E1%BB%93%20Ch%C3%AD%20Minh`
  );
  assert.equal(wRes.status, 200);
  const wBody = await wRes.json();
  assert.equal(wBody.snapshot.precipMmPerHr, 0);
  assert.equal(wBody.snapshot.conditionText, 'Trời nắng quang đãng');
  assert.equal(wBody.snapshot.verification?.consensusLevel, 'verified_multi_source');
  assert.equal(wBody.snapshot.verification?.reconciledRainAdjusted, true);
  assert.equal(metarCalls, 1, 'Should reuse 5-minute verification cache on /api/weather');
});
