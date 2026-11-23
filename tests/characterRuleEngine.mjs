import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Allow Node's built-in TypeScript loader to resolve extensionless relative imports in src/core/*.ts
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
});

const core = await import('../src/core/index.ts');

const {
  AUTO_REFRESH_INTERVAL_MINUTES,
  AUTO_REFRESH_INTERVAL_MS,
  ALL_NPC_ACTIONS,
  NPC_ACTION_META,
  NPC_ROTATION_INTERVAL_MS,
  NPC_STAND_DURATION_MS,
  PRESET_CITIES,
  DEMO_WEATHER_PRESETS,
  evaluateCharacterDecision,
  pickNextRandomNpcAction,
  buildGoogleWeatherUrls,
  buildTomorrowIoUrl,
  buildWeatherApiUrl,
  fetchGoogleWeather,
  fetchTomorrowIoWeather,
  fetchWeatherApiWeather,
  fetchOpenMeteoWeather,
  fetchWeatherSnapshot,
  pm25ToUsAqi,
} = core;

function makeSnapshot(overrides = {}) {
  return {
    provider: 'demo',
    locationName: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
    updatedAtIso: '2026-05-15T03:00:00.000Z',
    temperatureC: 26,
    feelsLikeC: 26,
    humidityPct: 65,
    windSpeedKmh: 10,
    windGustKmh: 15,
    uvIndex: 5,
    precipMmPerHr: 0,
    precipProbPct: 10,
    conditionText: 'Trời nắng đẹp',
    isDay: true,
    aqi: 45,
    hourly: Array.from({ length: 8 }, (_, idx) => ({
      timeIso: new Date(Date.parse('2026-05-15T03:00:00.000Z') + (idx + 1) * 3600_000).toISOString(),
      temperatureC: 26,
      precipProbPct: 10,
      precipMm: 0,
      conditionCode: 'CLEAR',
    })),
    ...overrides,
  };
}

test('PRESET_CITIES exposes all 6 required Vietnamese cities', () => {
  assert.equal(PRESET_CITIES.length, 6);
  const names = PRESET_CITIES.map((c) => c.nameVi);
  assert.deepEqual(names, [
    'Hà Nội',
    'TP. Hồ Chí Minh',
    'Đà Lạt',
    'Đà Nẵng',
    'Sa Pa',
    'Cần Thơ',
  ]);
});

test('evaluateCharacterDecision covers all 7 CharacterSceneId states, priority order & crisp non-AI copy', () => {
  // 1. storm_raincoat via heavy rain mm/hr >= 4.5 (even if hot)
  const stormByMm = evaluateCharacterDecision(
    makeSnapshot({ precipMmPerHr: 5.2, precipProbPct: 40, feelsLikeC: 35 }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(stormByMm.sceneId, 'storm_raincoat');
  assert.equal(stormByMm.skyTheme, 'rain_storm');
  assert.doesNotMatch(stormByMm.headlineVi, /Cậu bé Mây|Cô bé Nắng|!/);

  // 1b. storm_raincoat via precipProbPct >= 60 && windGustKmh >= 32
  const stormByGust = evaluateCharacterDecision(
    makeSnapshot({ precipMmPerHr: 0.5, precipProbPct: 65, windGustKmh: 36 }),
    { gender: 'female', sensitivity: 'normal' }
  );
  assert.equal(stormByGust.sceneId, 'storm_raincoat');
  assert.doesNotMatch(stormByGust.headlineVi, /Cậu bé Mây|Cô bé Nắng|!/);

  // 2. light_rain_umbrella via precipMmPerHr >= 0.2 or precipProbPct >= 50
  const lightRain = evaluateCharacterDecision(
    makeSnapshot({ precipMmPerHr: 0.4, precipProbPct: 40, windGustKmh: 18 }),
    { gender: 'female', sensitivity: 'normal' }
  );
  assert.equal(lightRain.sceneId, 'light_rain_umbrella');
  assert.equal(lightRain.skyTheme, 'rain_storm');

  const lightRainByProb = evaluateCharacterDecision(
    makeSnapshot({ precipMmPerHr: 0, precipProbPct: 55, windGustKmh: 20 }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(lightRainByProb.sceneId, 'light_rain_umbrella');

  // 3. Daytime hot_sunny via effectiveTemp >= 33 (overcast uvIndex < 6 -> Trời oi nóng, NOT UV cao)
  const hotByTempOvercastDay = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 34, uvIndex: 4, isDay: true }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(hotByTempOvercastDay.sceneId, 'hot_sunny');
  assert.equal(hotByTempOvercastDay.badgeVi, '🌡️ Trời oi nóng');
  assert.doesNotMatch(hotByTempOvercastDay.badgeVi, /UV|kính râm|chống nắng/i);
  assert.doesNotMatch(hotByTempOvercastDay.headlineVi, /UV|kính râm|chống nắng/i);
  assert.doesNotMatch(hotByTempOvercastDay.outfitAdviceVi, /UV|kính râm|chống nắng/i);

  const hotByUvDay = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 28, uvIndex: 8.5, isDay: true }),
    { gender: 'female', sensitivity: 'normal' }
  );
  assert.equal(hotByUvDay.sceneId, 'hot_sunny');
  assert.match(hotByUvDay.badgeVi, /UV/i);

  // 4. Nighttime (isDay=false) with effectiveTemp >= 22 -> clear_night (never hot_sunny or pleasant_sunny)
  const nightNotHotUv = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 25, uvIndex: 9, isDay: false }),
    { gender: 'female', sensitivity: 'normal' }
  );
  assert.equal(nightNotHotUv.sceneId, 'clear_night');
  assert.equal(nightNotHotUv.skyTheme, 'night');
  assert.equal(nightNotHotUv.badgeVi, '🌙 Đêm dịu mát');

  // 5. pleasant_sunny (daytime 22 <= effectiveTemp < 33)
  const pleasant = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 25, uvIndex: 5, isDay: true }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(pleasant.sceneId, 'pleasant_sunny');
  assert.equal(pleasant.skyTheme, 'day_sunny');

  // 6. chilly_cozy (16 <= effectiveTemp < 22)
  const chilly = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 18, uvIndex: 3 }),
    { gender: 'female', sensitivity: 'normal' }
  );
  assert.equal(chilly.sceneId, 'chilly_cozy');

  // 7. freezing_puffer (effectiveTemp < 16)
  const freezing = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 11, uvIndex: 2 }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(freezing.sceneId, 'freezing_puffer');

  // Verify concise, non-AI copy across all scenes
  for (const decision of [
    stormByMm,
    lightRain,
    hotByTempOvercastDay,
    hotByUvDay,
    nightNotHotUv,
    pleasant,
    chilly,
    freezing,
  ]) {
    assert.doesNotMatch(decision.headlineVi, /Cậu bé Mây|Cô bé Nắng|!|~/);
    assert.doesNotMatch(decision.outfitAdviceVi, /Cậu bé Mây|Cô bé Nắng|!|~/);
    const adviceWords = decision.outfitAdviceVi.trim().split(/\s+/).length;
    assert.ok(
      adviceWords >= 4 && adviceWords <= 9,
      `Expected outfitAdviceVi to be 4..9 words, got ${adviceWords}: "${decision.outfitAdviceVi}"`
    );
  }
});

test('Nighttime HCMC muggy regression (22:44, feelsLike 35C, uvIndex 0, isDay false) returns clear_night with zero UV/sunglasses copy', () => {
  const hcmcNight = evaluateCharacterDecision(
    makeSnapshot({
      locationName: 'TP. Hồ Chí Minh',
      temperatureC: 29.4,
      feelsLikeC: 35,
      uvIndex: 0,
      isDay: false,
      conditionText: 'Trời quang mây',
    }),
    { gender: 'male', sensitivity: 'normal' }
  );

  assert.equal(hcmcNight.sceneId, 'clear_night');
  assert.equal(hcmcNight.skyTheme, 'night');
  assert.equal(hcmcNight.badgeVi, '🌙 Đêm oi bức');
  assert.doesNotMatch(hcmcNight.badgeVi, /kính râm|chống nắng|UV|nắng|mũ rộng vành/i);
  assert.doesNotMatch(hcmcNight.headlineVi, /kính râm|chống nắng|UV|nắng|mũ rộng vành/i);
  assert.doesNotMatch(hcmcNight.outfitAdviceVi, /kính râm|chống nắng|UV|nắng|mũ rộng vành/i);

  // Night chilly & freezing stay chilly_cozy / freezing_puffer with skyTheme = 'night'
  const nightChilly = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 19, uvIndex: 0, isDay: false }),
    { gender: 'female', sensitivity: 'normal' }
  );
  assert.equal(nightChilly.sceneId, 'chilly_cozy');
  assert.equal(nightChilly.skyTheme, 'night');

  const nightFreezing = evaluateCharacterDecision(
    makeSnapshot({ feelsLikeC: 12, uvIndex: 0, isDay: false }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(nightFreezing.sceneId, 'freezing_puffer');
  assert.equal(nightFreezing.skyTheme, 'night');
});

test('Thermal sensitivity shifts effectiveTemp by -3 / 0 / +3 across thresholds', () => {
  // At 23C feelsLike: cold_sensitive (-3 => 20C) -> chilly_cozy; normal (23C) -> pleasant_sunny
  const base23 = makeSnapshot({ feelsLikeC: 23, uvIndex: 4 });
  assert.equal(
    evaluateCharacterDecision(base23, { gender: 'female', sensitivity: 'cold_sensitive' }).sceneId,
    'chilly_cozy'
  );
  assert.equal(
    evaluateCharacterDecision(base23, { gender: 'female', sensitivity: 'normal' }).sceneId,
    'pleasant_sunny'
  );

  // At 17C feelsLike: cold_sensitive (-3 => 14C) -> freezing_puffer; normal (17C) -> chilly_cozy
  const base17 = makeSnapshot({ feelsLikeC: 17, uvIndex: 3 });
  assert.equal(
    evaluateCharacterDecision(base17, { gender: 'male', sensitivity: 'cold_sensitive' }).sceneId,
    'freezing_puffer'
  );
  assert.equal(
    evaluateCharacterDecision(base17, { gender: 'male', sensitivity: 'normal' }).sceneId,
    'chilly_cozy'
  );

  // At 31C feelsLike: heat_sensitive (+3 => 34C) -> hot_sunny; normal (31C) -> pleasant_sunny
  const base31 = makeSnapshot({ feelsLikeC: 31, uvIndex: 5 });
  assert.equal(
    evaluateCharacterDecision(base31, { gender: 'male', sensitivity: 'heat_sensitive' }).sceneId,
    'hot_sunny'
  );
  assert.equal(
    evaluateCharacterDecision(base31, { gender: 'male', sensitivity: 'normal' }).sceneId,
    'pleasant_sunny'
  );
});

test('Foresight rain-ahead prop triggers within 1..6 hours only when not currently raining', () => {
  const hourlyRainIn3h = Array.from({ length: 8 }, (_, idx) => ({
    timeIso: new Date(Date.parse('2026-05-15T03:00:00.000Z') + (idx + 1) * 3600_000).toISOString(),
    temperatureC: 28,
    precipProbPct: idx === 2 ? 70 : 15,
    precipMm: idx === 2 ? 1.5 : 0,
    conditionCode: idx === 2 ? 'RAIN' : 'CLEAR',
  }));

  const sunnyForesight = evaluateCharacterDecision(
    makeSnapshot({ hourly: hourlyRainIn3h }),
    { gender: 'female', sensitivity: 'normal' }
  );
  assert.equal(sunnyForesight.sceneId, 'pleasant_sunny');
  assert.equal(sunnyForesight.hasRainAheadProp, true);
  assert.equal(sunnyForesight.rainAheadHours, 3);
  assert.match(sunnyForesight.outfitAdviceVi, /3h/);

  // Trigger by precipMm >= 1.0 at hour +6 (index 5)
  const hourlyRainIn6h = Array.from({ length: 8 }, (_, idx) => ({
    timeIso: new Date(Date.parse('2026-05-15T03:00:00.000Z') + (idx + 1) * 3600_000).toISOString(),
    temperatureC: 26,
    precipProbPct: 30,
    precipMm: idx === 5 ? 1.1 : 0,
    conditionCode: 'CLOUDY',
  }));
  const sixthHourForesight = evaluateCharacterDecision(
    makeSnapshot({ hourly: hourlyRainIn6h }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(sixthHourForesight.hasRainAheadProp, true);
  assert.equal(sixthHourForesight.rainAheadHours, 6);

  // Hour +7 (index 6) is outside 1..6 window -> should be false
  const hourlyRainIn7h = Array.from({ length: 8 }, (_, idx) => ({
    timeIso: new Date(Date.parse('2026-05-15T03:00:00.000Z') + (idx + 1) * 3600_000).toISOString(),
    temperatureC: 26,
    precipProbPct: idx === 6 ? 90 : 10,
    precipMm: idx === 6 ? 4.0 : 0,
    conditionCode: 'CLEAR',
  }));
  const seventhHour = evaluateCharacterDecision(
    makeSnapshot({ hourly: hourlyRainIn7h }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(seventhHour.hasRainAheadProp, false);
  assert.equal(seventhHour.rainAheadHours, null);

  // Currently raining -> hasRainAheadProp must be false
  const alreadyRaining = evaluateCharacterDecision(
    makeSnapshot({ precipMmPerHr: 1.0, precipProbPct: 80, hourly: hourlyRainIn3h }),
    { gender: 'male', sensitivity: 'normal' }
  );
  assert.equal(alreadyRaining.sceneId, 'light_rain_umbrella');
  assert.equal(alreadyRaining.hasRainAheadProp, false);
  assert.equal(alreadyRaining.rainAheadHours, null);
});

test('AQI mask activates at AQI >= 130', () => {
  const cleanAir = evaluateCharacterDecision(makeSnapshot({ aqi: 129 }), {
    gender: 'male',
    sensitivity: 'normal',
  });
  assert.equal(cleanAir.hasAqiMask, false);

  const pollutedBoundary = evaluateCharacterDecision(makeSnapshot({ aqi: 130 }), {
    gender: 'female',
    sensitivity: 'normal',
  });
  assert.equal(pollutedBoundary.hasAqiMask, true);
  assert.match(pollutedBoundary.outfitAdviceVi, /khẩu trang/i);

  const missingAqi = evaluateCharacterDecision(makeSnapshot({ aqi: undefined }), {
    gender: 'male',
    sensitivity: 'normal',
  });
  assert.equal(missingAqi.hasAqiMask, false);
});

test('DEMO_WEATHER_PRESETS cover all 8 showcase states cleanly', () => {
  assert.equal(
    evaluateCharacterDecision(DEMO_WEATHER_PRESETS.sunny, { gender: 'male', sensitivity: 'normal' }).sceneId,
    'pleasant_sunny'
  );
  assert.equal(
    evaluateCharacterDecision(DEMO_WEATHER_PRESETS.hot_uv, { gender: 'female', sensitivity: 'normal' }).sceneId,
    'hot_sunny'
  );
  assert.equal(
    evaluateCharacterDecision(DEMO_WEATHER_PRESETS.light_rain, { gender: 'male', sensitivity: 'normal' }).sceneId,
    'light_rain_umbrella'
  );
  assert.equal(
    evaluateCharacterDecision(DEMO_WEATHER_PRESETS.heavy_storm, { gender: 'female', sensitivity: 'normal' }).sceneId,
    'storm_raincoat'
  );

  const foresightPreset = evaluateCharacterDecision(DEMO_WEATHER_PRESETS.sunny_rain_ahead, {
    gender: 'male',
    sensitivity: 'normal',
  });
  assert.equal(foresightPreset.sceneId, 'pleasant_sunny');
  assert.equal(foresightPreset.hasRainAheadProp, true);
  assert.equal(foresightPreset.rainAheadHours, 3);

  assert.equal(
    evaluateCharacterDecision(DEMO_WEATHER_PRESETS.chilly_dalat, { gender: 'female', sensitivity: 'normal' }).sceneId,
    'chilly_cozy'
  );
  assert.equal(
    evaluateCharacterDecision(DEMO_WEATHER_PRESETS.freezing_sapa, { gender: 'male', sensitivity: 'normal' }).sceneId,
    'freezing_puffer'
  );

  const hanoiAqi = evaluateCharacterDecision(DEMO_WEATHER_PRESETS.high_aqi_hanoi, {
    gender: 'female',
    sensitivity: 'normal',
  });
  assert.equal(hanoiAqi.hasAqiMask, true);
});

test('googleWeatherClient builds v1 URLs and maps WeatherNext response fields', async () => {
  const urls = buildGoogleWeatherUrls(10.8231, 106.6297, 'TEST_KEY_123');
  assert.match(urls.currentUrl, /^https:\/\/weather\.googleapis\.com\/v1\/currentConditions:lookup\?/);
  assert.match(urls.hourlyUrl, /^https:\/\/weather\.googleapis\.com\/v1\/forecast\/hours:lookup\?/);
  assert.match(urls.currentUrl, /unitsSystem=METRIC/);
  assert.match(urls.currentUrl, /location\.latitude=10\.8231/);
  assert.match(urls.currentUrl, /location\.longitude=106\.6297/);
  assert.match(urls.currentUrl, /key=TEST_KEY_123/);

  const mockFetch = async (url) => {
    const str = String(url);
    if (str.includes('currentConditions:lookup')) {
      return new Response(
        JSON.stringify({
          currentTime: '2026-05-15T06:00:00Z',
          isDaytime: true,
          weatherCondition: {
            type: 'PARTLY_CLOUDY',
            description: { text: 'Có mây rải rác', languageCode: 'vi' },
          },
          temperature: { degrees: 31.4, unit: 'CELSIUS' },
          feelsLikeTemperature: { degrees: 34.2, unit: 'CELSIUS' },
          relativeHumidity: 66,
          uvIndex: 9,
          wind: {
            speed: { value: 14.5, unit: 'KILOMETERS_PER_HOUR' },
            gust: { value: 24.0, unit: 'KILOMETERS_PER_HOUR' },
          },
          precipitation: {
            probability: { percent: 25 },
            qpf: { quantity: 0.0, unit: 'MILLIMETERS' },
          },
        }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        forecastHours: [
          {
            interval: { startTime: '2026-05-15T07:00:00Z', endTime: '2026-05-15T08:00:00Z' },
            temperature: { degrees: 32.0, unit: 'CELSIUS' },
            precipitation: { probability: { percent: 70 }, qpf: { quantity: 2.4 } },
            weatherCondition: { type: 'RAIN' },
          },
        ],
      }),
      { status: 200 }
    );
  };

  const snap = await fetchGoogleWeather(10.8231, 106.6297, 'TP. Hồ Chí Minh', 'TEST_KEY_123', mockFetch);
  assert.equal(snap.provider, 'google');
  assert.equal(snap.temperatureC, 31.4);
  assert.equal(snap.feelsLikeC, 34.2);
  assert.equal(snap.humidityPct, 66);
  assert.equal(snap.uvIndex, 9);
  assert.equal(snap.windSpeedKmh, 14.5);
  assert.equal(snap.windGustKmh, 24);
  assert.equal(snap.precipProbPct, 25);
  assert.equal(snap.precipMmPerHr, 0);
  assert.equal(snap.isDay, true);
  assert.equal(snap.hourly.length, 1);
  assert.equal(snap.hourly[0].precipProbPct, 70);
  assert.equal(snap.hourly[0].precipMm, 2.4);
});

test('weatherService auto mode falls back cleanly to Open-Meteo when Google fails, and live Open-Meteo call succeeds', async () => {
  const liveSnap = await fetchOpenMeteoWeather(21.0285, 105.8542, 'Hà Nội');
  assert.equal(liveSnap.provider, 'open_meteo');
  assert.equal(liveSnap.locationName, 'Hà Nội');
  assert.equal(typeof liveSnap.temperatureC, 'number');
  assert.ok(Number.isFinite(liveSnap.temperatureC));
  assert.ok(Array.isArray(liveSnap.hourly) && liveSnap.hourly.length >= 12);

  const liveDecision = evaluateCharacterDecision(liveSnap, {
    gender: 'male',
    sensitivity: 'normal',
  });
  assert.ok(liveDecision.sceneId);
  assert.ok(liveDecision.headlineVi.length > 5);

  // Verify auto fallback with invalid Google key still resolves via Open-Meteo
  const autoFallbackSnap = await fetchWeatherSnapshot({
    latitude: 11.9404,
    longitude: 108.4583,
    locationName: 'Đà Lạt',
    provider: 'auto',
    googleApiKey: 'INVALID_DEMO_KEY',
  });
  assert.equal(autoFallbackSnap.provider, 'open_meteo');
  assert.equal(autoFallbackSnap.locationName, 'Đà Lạt');
});

test('15-minute auto-refresh interval constants are configured accurately', () => {
  assert.equal(AUTO_REFRESH_INTERVAL_MINUTES, 15);
  assert.equal(AUTO_REFRESH_INTERVAL_MS, 15 * 60 * 1000);
});

test('tomorrowIoClient builds v4 forecast URL, converts m/s wind to km/h, and blends 15m precipitation', async () => {
  const url = buildTomorrowIoUrl(10.8231, 106.6297, 'TOMORROW_DEMO_KEY');
  assert.match(url, /^https:\/\/api\.tomorrow\.io\/v4\/weather\/forecast\?/);
  assert.match(url, /timesteps=1m%2C1h/);
  assert.match(url, /units=metric/);
  assert.match(url, /apikey=TOMORROW_DEMO_KEY/);

  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        timelines: {
          minutely: [
            {
              time: '2026-05-15T03:00:00Z',
              values: {
                temperature: 29.5,
                temperatureApparent: 32.0,
                humidity: 76,
                windSpeed: 5.0, // 18 km/h
                windGust: 10.0, // 36 km/h
                uvIndex: 6,
                precipitationIntensity: 0.3,
                precipitationProbability: 65,
                weatherCode: 4200,
              },
            },
            {
              time: '2026-05-15T03:01:00Z',
              values: { precipitationIntensity: 2.2 },
            },
          ],
          hourly: [
            {
              time: '2026-05-15T03:00:00Z',
              values: { temperature: 29.5, precipitationProbability: 65, precipitationIntensity: 0.3, weatherCode: 4200 },
            },
            {
              time: '2026-05-15T04:00:00Z',
              values: { temperature: 28.0, precipitationProbability: 85, precipitationIntensity: 3.1, weatherCode: 4001 },
            },
          ],
        },
      }),
      { status: 200 }
    );

  const snap = await fetchTomorrowIoWeather(10.8231, 106.6297, 'TP. Hồ Chí Minh', 'TOMORROW_DEMO_KEY', mockFetch);
  assert.equal(snap.provider, 'tomorrow_io');
  assert.equal(snap.temperatureC, 29.5);
  assert.equal(snap.feelsLikeC, 32);
  assert.equal(snap.windSpeedKmh, 18);
  assert.equal(snap.windGustKmh, 36);
  assert.equal(snap.precipMmPerHr, 2.2);
  assert.equal(snap.precipProbPct, 65);
  assert.equal(snap.hourly.length, 1);
  assert.equal(snap.hourly[0].precipProbPct, 85);
});

test('weatherApiClient maps WeatherAPI.com response and converts PM2.5 to US AQI', async () => {
  assert.equal(pm25ToUsAqi(65.0) >= 130, true);
  const url = buildWeatherApiUrl(21.0285, 105.8542, 'WA_DEMO_KEY');
  assert.match(url, /^https:\/\/api\.weatherapi\.com\/v1\/forecast\.json\?/);
  assert.match(url, /aqi=yes/);
  assert.match(url, /lang=vi/);

  const baseEpoch = 1778814000;
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        current: {
          last_updated_epoch: baseEpoch,
          temp_c: 24.5,
          feelslike_c: 25.0,
          is_day: 1,
          humidity: 70,
          wind_kph: 8.5,
          gust_kph: 14.0,
          precip_mm: 0.0,
          uv: 4,
          condition: { code: 1003, text: 'Có mây' },
          air_quality: { pm2_5: 62.0 },
        },
        forecast: {
          forecastday: [
            {
              hour: [
                { time_epoch: baseEpoch, temp_c: 24.5, precip_mm: 0, chance_of_rain: 15, condition: { code: 1003 } },
                { time_epoch: baseEpoch + 3600, temp_c: 25.5, precip_mm: 1.8, chance_of_rain: 75, condition: { code: 1183 } },
              ],
            },
          ],
        },
      }),
      { status: 200 }
    );

  const snap = await fetchWeatherApiWeather(21.0285, 105.8542, 'Hà Nội', 'WA_DEMO_KEY', mockFetch);
  assert.equal(snap.provider, 'weatherapi');
  assert.equal(snap.aqi >= 130, true);
  assert.equal(snap.hourly.length, 1);
  assert.equal(snap.hourly[0].precipProbPct, 75);
});

test('npcBehavior exports 5 actions, 300_000ms rotation interval, and pickNextRandomNpcAction never repeats back-to-back', () => {
  assert.equal(NPC_ROTATION_INTERVAL_MS, 300_000);
  assert.equal(NPC_STAND_DURATION_MS, 8500);
  assert.deepEqual(ALL_NPC_ACTIONS, [
    'reading_book',
    'petting_cat',
    'petting_puppy',
    'scrolling_phone',
    'listening_music',
  ]);

  assert.equal(NPC_ACTION_META.reading_book.labelVi, 'Đọc sách');
  assert.equal(NPC_ACTION_META.petting_cat.labelVi, 'Chơi với mèo');
  assert.equal(NPC_ACTION_META.petting_puppy.labelVi, 'Chơi với cún');
  assert.equal(NPC_ACTION_META.scrolling_phone.labelVi, 'Xem điện thoại');
  assert.equal(NPC_ACTION_META.listening_music.labelVi, 'Nghe nhạc');

  // Without current action, covers all 5 actions uniformly across [0, 1)
  const initialSeen = new Set();
  for (const r of [0.0, 0.2, 0.4, 0.6, 0.8]) {
    initialSeen.add(pickNextRandomNpcAction(null, () => r));
  }
  assert.equal(initialSeen.size, 5);

  // With current action, never repeats current across any RNG value and reaches all other 4 actions
  for (const current of ALL_NPC_ACTIONS) {
    const nextSeen = new Set();
    for (const r of [0.0, 0.249, 0.25, 0.499, 0.5, 0.749, 0.75, 0.999, 1.0]) {
      const picked = pickNextRandomNpcAction(current, () => r);
      assert.notEqual(picked, current);
      nextSeen.add(picked);
    }
    assert.equal(nextSeen.size, 4);
  }

  // Sequential chain of 200 random steps never repeats back-to-back and visits all 5 actions
  let current = pickNextRandomNpcAction(undefined);
  const visitedChain = new Set([current]);
  for (let step = 0; step < 200; step += 1) {
    const next = pickNextRandomNpcAction(current);
    assert.notEqual(next, current);
    visitedChain.add(next);
    current = next;
  }
  assert.equal(visitedChain.size, 5);
});
