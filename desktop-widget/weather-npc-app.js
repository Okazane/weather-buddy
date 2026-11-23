/**
 * WeatherBuddy v3 PC & Browser Suite Engine (weather-npc-app.js)
 * Shared across:
 *   - newtab.html (New Tab Dashboard)
 *   - popup.html (Toolbar Popup)
 *   - options.html (Full Feature & Installation Control Center)
 *   - desktop-widget/widget.html (Windows Screen Companion Widget)
 *
 * Security & Quality Guarantees:
 *   - ZERO hardcoded API keys (100% empty by default; uses Open-Meteo Free when blank)
 *   - ZERO innerHTML usage (strictly DOM createElement + textContent to prevent XSS)
 *   - Masked type="password" API key inputs with Show/Hide toggle
 *   - Sends X-WeatherBuddy-Client: weatherbuddy-ui header on local Desktop Widget launch POST
 *   - Exact v3 Character Rule Engine (clear_night at night, zero sunglasses/UV talk at night)
 *   - 5 random Chibi NPC actions rotating every 5 minutes + 8.5s spring stand-up on click
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'weatherbuddy_pc_config_v3';
  const CACHE_KEY = 'weatherbuddy_pc_weather_cache_v3';
  const NPC_ROTATION_INTERVAL_MS = 5 * 60 * 1000;
  const NPC_STAND_DURATION_MS = 8500;
  const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

  const PRESET_CITIES = [
    { id: 'ha_noi', nameVi: 'Hà Nội', regionVi: 'Miền Bắc', latitude: 21.0285, longitude: 105.8542 },
    { id: 'tp_hcm', nameVi: 'TP. Hồ Chí Minh', regionVi: 'Miền Nam', latitude: 10.8231, longitude: 106.6297 },
    { id: 'da_lat', nameVi: 'Đà Lạt', regionVi: 'Tây Nguyên', latitude: 11.9404, longitude: 108.4583 },
    { id: 'da_nang', nameVi: 'Đà Nẵng', regionVi: 'Miền Trung', latitude: 16.0544, longitude: 108.2022 },
    { id: 'sa_pa', nameVi: 'Sa Pa', regionVi: 'Tây Bắc', latitude: 22.3364, longitude: 103.8438 },
    { id: 'can_tho', nameVi: 'Cần Thơ', regionVi: 'Miền Tây', latitude: 10.0452, longitude: 105.7469 },
  ];

  const ALL_NPC_ACTIONS = [
    'reading_book',
    'petting_cat',
    'petting_puppy',
    'scrolling_phone',
    'listening_music',
  ];

  const NPC_ACTION_META = {
    reading_book: { id: 'reading_book', labelVi: 'Đọc sách', accentIcon: '📖' },
    petting_cat: { id: 'petting_cat', labelVi: 'Chơi với mèo', accentIcon: '🐾' },
    petting_puppy: { id: 'petting_puppy', labelVi: 'Chơi với cún', accentIcon: '🐶' },
    scrolling_phone: { id: 'scrolling_phone', labelVi: 'Xem điện thoại', accentIcon: '✨' },
    listening_music: { id: 'listening_music', labelVi: 'Nghe nhạc', accentIcon: '🎵' },
  };

  const DEFAULT_CONFIG = {
    cityId: 'ha_noi',
    locationName: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
    isGps: false,
    gender: 'male',
    sensitivity: 'normal',
    provider: 'auto',
    enableNewTabOverride: true,
    showClock: true,
    showSearch: true,
    searchEngine: 'google',
    showHourly: true,
    showTelemetry: true,
    autoRotateNpc: true,
    compactMode: false,
    widgetCorner: 'BottomRight',
    widgetSize: 'Standard',
    alwaysOnTop: true,
    googleApiKey: '',
    tomorrowApiKey: '',
    weatherApiKey: '',
  };

  function redactSecrets(text) {
    if (!text) return '';
    return String(text)
      .replace(/(key|apikey)=[^&\s"']+/gi, '$1=[REDACTED]')
      .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED_GOOGLE_KEY]');
  }

  function hasChromeStorage() {
    return (
      typeof chrome !== 'undefined' &&
      chrome &&
      chrome.storage &&
      chrome.storage.local
    );
  }

  async function loadConfig() {
    let raw = null;
    if (hasChromeStorage()) {
      raw = await new Promise((resolve) => {
        try {
          chrome.storage.local.get([STORAGE_KEY], (res) => resolve(res ? res[STORAGE_KEY] : null));
        } catch {
          resolve(null);
        }
      });
    }
    if (!raw) {
      try {
        const str = localStorage.getItem(STORAGE_KEY);
        if (str) raw = JSON.parse(str);
      } catch {
        raw = null;
      }
    }

    const merged = Object.assign({}, DEFAULT_CONFIG, raw || {});
    // URL query overrides for desktop-widget launcher (?corner=BottomRight&size=Compact&gender=female)
    try {
      const params = new URLSearchParams(window.location.search);
      const qGender = params.get('gender');
      if (qGender === 'male' || qGender === 'female') {
        merged.gender = qGender;
      }
      const qSize = params.get('size');
      if (qSize === 'Compact') {
        merged.compactMode = true;
        merged.widgetSize = 'Compact';
      } else if (qSize === 'Standard') {
        merged.compactMode = false;
        merged.widgetSize = 'Standard';
      }
      const qCorner = params.get('corner');
      if (
        qCorner === 'BottomRight' ||
        qCorner === 'TopRight' ||
        qCorner === 'BottomLeft' ||
        qCorner === 'TopLeft'
      ) {
        merged.widgetCorner = qCorner;
      }
    } catch {
      // Ignore query errors
    }

    return merged;
  }

  async function saveConfig(cfg) {
    const clean = Object.assign({}, DEFAULT_CONFIG, cfg);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore localStorage quota error
    }
    if (hasChromeStorage()) {
      await new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [STORAGE_KEY]: clean }, () => resolve());
        } catch {
          resolve();
        }
      });
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        // Ignore
      }
    }
  }

  async function saveWeatherCache(snapshot) {
    const entry = { savedAt: Date.now(), snapshot };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
      // Ignore
    }
    if (hasChromeStorage()) {
      await new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [CACHE_KEY]: entry }, () => resolve());
        } catch {
          resolve();
        }
      });
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'WEATHER_SNAPSHOT_UPDATED', snapshot }, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        // Ignore
      }
    }
  }

  async function loadWeatherCache() {
    try {
      const str = localStorage.getItem(CACHE_KEY);
      if (str) return JSON.parse(str);
    } catch {
      // Ignore
    }
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([CACHE_KEY], (res) => resolve(res ? res[CACHE_KEY] : null));
        } catch {
          resolve(null);
        }
      });
    }
    return null;
  }

  // ============================================================================
  // EXACT V3 CHARACTER RULE ENGINE (Ported 1:1 from src/core/characterRuleEngine.ts)
  // ============================================================================

  function pickNextRandomNpcAction(current) {
    const candidates =
      current && ALL_NPC_ACTIONS.includes(current)
        ? ALL_NPC_ACTIONS.filter((a) => a !== current)
        : ALL_NPC_ACTIONS;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx] || ALL_NPC_ACTIONS[0];
  }

  function resolveSkyTheme(weather, sceneId) {
    if (sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella') {
      return 'rain_storm';
    }
    if (!weather.isDay || sceneId === 'clear_night') {
      return 'night';
    }
    const condLower = (weather.conditionText || '').toLowerCase();
    if (/bình minh|dawn|sunrise/.test(condLower)) {
      return 'dawn';
    }
    if (/hoàng hôn|chiều tà|sunset|dusk/.test(condLower)) {
      return 'sunset';
    }
    if (weather.uvIndex <= 1.2 && weather.updatedAtIso) {
      const parsedMs = Date.parse(weather.updatedAtIso);
      if (Number.isFinite(parsedMs)) {
        const utcHour = new Date(parsedMs).getUTCHours();
        const approxOffsetHrs = Math.round(weather.longitude / 15);
        const localHour = (utcHour + approxOffsetHrs + 24) % 24;
        if (localHour >= 5 && localHour <= 6) return 'dawn';
        if (localHour >= 17 && localHour <= 18) return 'sunset';
      }
    }
    if (
      /mây|âm u|sương mù|bụi|cloud|overcast|fog|mist|haze/.test(condLower) ||
      (weather.aqi || 0) >= 150 ||
      ((sceneId === 'chilly_cozy' || sceneId === 'freezing_puffer') && weather.uvIndex <= 3)
    ) {
      return 'day_cloudy';
    }
    return 'day_sunny';
  }

  function evaluateCharacterDecision(weather, prefs) {
    const sensitivityDelta =
      prefs.sensitivity === 'cold_sensitive'
        ? -3
        : prefs.sensitivity === 'heat_sensitive'
          ? 3
          : 0;
    const effectiveTemp = weather.feelsLikeC + sensitivityDelta;

    let sceneId;
    if (
      weather.precipMmPerHr >= 4.5 ||
      (weather.precipProbPct >= 60 && weather.windGustKmh >= 32)
    ) {
      sceneId = 'storm_raincoat';
    } else if (weather.precipMmPerHr >= 0.2 || weather.precipProbPct >= 50) {
      sceneId = 'light_rain_umbrella';
    } else if (!weather.isDay) {
      // Nighttime (not raining): NEVER return hot_sunny or pleasant_sunny
      if (effectiveTemp >= 22) {
        sceneId = 'clear_night';
      } else if (effectiveTemp >= 16) {
        sceneId = 'chilly_cozy';
      } else {
        sceneId = 'freezing_puffer';
      }
    } else if (effectiveTemp >= 33 || weather.uvIndex >= 8) {
      sceneId = 'hot_sunny';
    } else if (effectiveTemp >= 22) {
      sceneId = 'pleasant_sunny';
    } else if (effectiveTemp >= 16) {
      sceneId = 'chilly_cozy';
    } else {
      sceneId = 'freezing_puffer';
    }

    const isCurrentlyRaining =
      sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella';
    let hasRainAheadProp = false;
    let rainAheadHours = null;

    if (!isCurrentlyRaining && Array.isArray(weather.hourly)) {
      const maxLookahead = Math.min(6, weather.hourly.length);
      for (let i = 0; i < maxLookahead; i += 1) {
        const h = weather.hourly[i];
        if (h && (h.precipProbPct >= 65 || h.precipMm >= 1.0)) {
          hasRainAheadProp = true;
          rainAheadHours = i + 1;
          break;
        }
      }
    }

    const hasAqiMask = (weather.aqi || 0) >= 130;
    const skyTheme = resolveSkyTheme(weather, sceneId);

    let headlineVi = '';
    let outfitAdviceVi = '';
    let badgeVi = '';

    switch (sceneId) {
      case 'storm_raincoat':
        badgeVi = '⛈️ Mưa lớn & gió mạnh';
        headlineVi = 'Mưa lớn gió mạnh';
        outfitAdviceVi = hasAqiMask
          ? 'Mặc áo mưa kín, đeo thêm khẩu trang'
          : 'Mặc áo mưa kín, tránh cầm ô';
        break;
      case 'light_rain_umbrella':
        badgeVi = '☔ Mưa nhỏ rải rác';
        headlineVi = 'Mưa nhỏ · Cầm ô';
        outfitAdviceVi = hasAqiMask
          ? 'Mang ô gọn, đeo khẩu trang khi ra đường'
          : 'Mang ô gọn và áo khoác trượt nước';
        break;
      case 'clear_night':
        if (effectiveTemp >= 32) {
          badgeVi = '🌙 Đêm oi bức';
          headlineVi = weather.windSpeedKmh <= 18 ? 'Đêm oi · Gió nhẹ' : 'Đêm oi · Có gió';
          outfitAdviceVi = 'Mặc đồ mỏng thoáng mát';
        } else {
          badgeVi = '🌙 Đêm dịu mát';
          headlineVi = 'Đêm thoáng mát';
          outfitAdviceVi =
            effectiveTemp < 25
              ? 'Mặc thoáng nhẹ, mang theo khoác mỏng'
              : 'Mặc đồ gọn nhẹ thoải mái';
        }
        break;
      case 'hot_sunny':
        if (weather.uvIndex >= 6) {
          badgeVi = '🕶️ Nắng gắt & UV cao';
          headlineVi = 'Oi nóng & UV cao';
          outfitAdviceVi = 'Mặc đồ thoáng mát, đeo kính chống nắng';
        } else {
          badgeVi = '🌡️ Trời oi nóng';
          headlineVi = 'Trời oi nóng';
          outfitAdviceVi = 'Mặc đồ mỏng thoáng mát, uống đủ nước';
        }
        break;
      case 'pleasant_sunny':
        if (skyTheme === 'day_cloudy') {
          badgeVi = '⛅ Trời dịu mát';
          headlineVi = 'Nhiều mây dịu mát';
        } else {
          badgeVi = '🌤️ Nắng đẹp';
          headlineVi = 'Trời nắng dịu';
        }
        outfitAdviceVi =
          weather.uvIndex >= 6 && skyTheme !== 'day_cloudy'
            ? 'Mặc đồ thoáng nhẹ, thoa kem chống nắng'
            : 'Mặc trang phục gọn nhẹ thoải mái';
        break;
      case 'chilly_cozy':
        badgeVi = weather.isDay ? '🍂 Trời se lạnh' : '🌙 Đêm se lạnh';
        headlineVi = weather.isDay ? 'Trời se lạnh' : 'Đêm se lạnh';
        outfitAdviceVi = 'Khoác áo mỏng khi ra ngoài';
        break;
      case 'freezing_puffer':
        badgeVi = weather.isDay ? '🧣 Trời rét đậm' : '🧣 Đêm rét đậm';
        headlineVi = weather.isDay ? 'Trời rét đậm' : 'Đêm rét đậm';
        outfitAdviceVi = 'Mặc áo phao dày, giữ ấm cổ';
        break;
      default:
        badgeVi = '🌤️ Thời tiết';
        headlineVi = 'Thời tiết ổn định';
        outfitAdviceVi = 'Mặc trang phục thoải mái';
    }

    if (
      sceneId !== 'storm_raincoat' &&
      sceneId !== 'light_rain_umbrella'
    ) {
      if (hasRainAheadProp && rainAheadHours !== null && hasAqiMask) {
        outfitAdviceVi = `Mang sẵn ô, mưa sau ${rainAheadHours}h · Đeo khẩu trang`;
      } else if (hasRainAheadProp && rainAheadHours !== null) {
        outfitAdviceVi = `Mang sẵn ô, dự báo mưa sau ${rainAheadHours}h`;
      } else if (hasAqiMask) {
        if (sceneId === 'freezing_puffer' || sceneId === 'chilly_cozy') {
          outfitAdviceVi = 'Mặc đủ ấm, đeo khẩu trang lọc bụi';
        } else if (sceneId === 'hot_sunny' && weather.uvIndex >= 6) {
          outfitAdviceVi = 'Chống nắng kỹ, đeo khẩu trang lọc bụi';
        } else {
          outfitAdviceVi = 'Mặc thoáng nhẹ, đeo khẩu trang lọc bụi';
        }
      }
    }

    return {
      sceneId,
      gender: prefs.gender,
      hasRainAheadProp,
      rainAheadHours,
      hasAqiMask,
      skyTheme,
      headlineVi,
      outfitAdviceVi,
      badgeVi,
    };
  }

  // ============================================================================
  // MULTI-PROVIDER WEATHER CLIENT (ZERO HARDCODED KEYS)
  // ============================================================================

  function mapWmoWeatherCode(code, isDay) {
    switch (code) {
      case 0:
        return { conditionCode: 'CLEAR', conditionTextVi: isDay ? 'Trời nắng quang đãng' : 'Đêm quang đãng' };
      case 1:
        return { conditionCode: 'MOSTLY_CLEAR', conditionTextVi: isDay ? 'Nắng nhẹ dễ chịu' : 'Đêm ít mây' };
      case 2:
        return { conditionCode: 'PARTLY_CLOUDY', conditionTextVi: 'Có mây rải rác' };
      case 3:
        return { conditionCode: 'CLOUDY', conditionTextVi: 'Trời nhiều mây' };
      case 45:
      case 48:
        return { conditionCode: 'FOG', conditionTextVi: 'Có sương mù nhẹ' };
      case 51:
      case 53:
      case 55:
      case 56:
      case 57:
        return { conditionCode: 'DRIZZLE', conditionTextVi: 'Mưa phùn lất phất' };
      case 61:
      case 80:
        return { conditionCode: 'LIGHT_RAIN', conditionTextVi: 'Mưa nhỏ rải rác' };
      case 63:
      case 81:
        return { conditionCode: 'RAIN', conditionTextVi: 'Mưa rào vừa' };
      case 65:
      case 66:
      case 67:
      case 82:
        return { conditionCode: 'HEAVY_RAIN', conditionTextVi: 'Mưa to nặng hạt' };
      case 95:
      case 96:
      case 99:
        return { conditionCode: 'THUNDERSTORM', conditionTextVi: 'Mưa dông kèm gió giật' };
      default:
        return { conditionCode: 'PARTLY_CLOUDY', conditionTextVi: isDay ? 'Thời tiết dịu nhẹ' : 'Đêm mát mẻ' };
    }
  }

  async function fetchOpenMeteoWeather(lat, lon, locationName) {
    const forecastParams = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'precipitation_probability',
        'weather_code',
        'wind_speed_10m',
        'wind_gusts_10m',
        'uv_index',
      ].join(','),
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'precipitation',
        'weather_code',
      ].join(','),
      minutely_15: 'precipitation',
      forecast_minutely_15: '2',
      forecast_days: '2',
      timezone: 'auto',
    });

    const aqiParams = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'us_aqi',
    });

    const [forecastRes, aqiRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${forecastParams.toString()}`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${aqiParams.toString()}`).catch(() => null),
    ]);

    if (!forecastRes.ok) {
      throw new Error(`Open-Meteo HTTP ${forecastRes.status}`);
    }

    const data = await forecastRes.json();
    let aqi;
    if (aqiRes && aqiRes.ok) {
      try {
        const aqiJson = await aqiRes.json();
        if (aqiJson && aqiJson.current && typeof aqiJson.current.us_aqi === 'number') {
          aqi = Math.max(0, Math.round(aqiJson.current.us_aqi));
        }
      } catch {
        // Ignore AQI error
      }
    }

    const cur = data.current || {};
    const isDay = (cur.is_day ?? 1) === 1;
    const temperatureC = Math.round((cur.temperature_2m ?? 26) * 10) / 10;
    const feelsLikeC = Math.round((cur.apparent_temperature ?? temperatureC) * 10) / 10;
    const humidityPct = Math.max(0, Math.min(100, Math.round(cur.relative_humidity_2m ?? 72)));
    const windSpeedKmh = Math.max(0, Math.round((cur.wind_speed_10m ?? 0) * 10) / 10);
    const windGustKmh = Math.max(windSpeedKmh, Math.round((cur.wind_gusts_10m ?? windSpeedKmh) * 10) / 10);
    const uvIndex = Math.max(0, Math.round((cur.uv_index ?? 0) * 10) / 10);

    const min15 = ((data.minutely_15 && data.minutely_15.precipitation) || [])
      .slice(0, 2)
      .reduce((m, v) => Math.max(m, typeof v === 'number' ? v : 0), 0);
    const precipMmPerHr = Math.max(
      0,
      Math.round(Math.max(cur.precipitation ?? 0, min15 * 4) * 100) / 100
    );
    const precipProbPct = Math.max(0, Math.min(100, Math.round(cur.precipitation_probability ?? 0)));
    const { conditionTextVi } = mapWmoWeatherCode(cur.weather_code, isDay);

    const hourlyTimes = (data.hourly && data.hourly.time) || [];
    const hourlyTemps = (data.hourly && data.hourly.temperature_2m) || [];
    const hourlyProbs = (data.hourly && data.hourly.precipitation_probability) || [];
    const hourlyPrecip = (data.hourly && data.hourly.precipitation) || [];
    const hourlyCodes = (data.hourly && data.hourly.weather_code) || [];

    const currentLocalTime = cur.time || '';
    let startIdx = 0;
    if (currentLocalTime && hourlyTimes.length > 0) {
      const found = hourlyTimes.findIndex((t) => t > currentLocalTime);
      startIdx = found >= 0 ? found : 0;
    }

    const hourly = [];
    const endIdx = Math.min(hourlyTimes.length, startIdx + 12);
    for (let i = startIdx; i < endIdx; i += 1) {
      const cInfo = mapWmoWeatherCode(hourlyCodes[i], true);
      hourly.push({
        timeIso: hourlyTimes[i] || new Date().toISOString(),
        temperatureC: Math.round((hourlyTemps[i] ?? temperatureC) * 10) / 10,
        precipProbPct: Math.max(0, Math.min(100, Math.round(hourlyProbs[i] ?? 0))),
        precipMm: Math.max(0, Math.round((hourlyPrecip[i] ?? 0) * 100) / 100),
        conditionCode: cInfo.conditionCode,
      });
    }

    const snapshot = {
      provider: 'open_meteo',
      locationName,
      latitude: lat,
      longitude: lon,
      updatedAtIso: new Date().toISOString(),
      temperatureC,
      feelsLikeC,
      humidityPct,
      windSpeedKmh,
      windGustKmh,
      uvIndex,
      precipMmPerHr,
      precipProbPct,
      conditionText: conditionTextVi,
      isDay,
      hourly,
    };
    if (typeof aqi === 'number') {
      snapshot.aqi = aqi;
    }
    return snapshot;
  }

  async function fetchWeatherApiCom(lat, lon, locationName, apiKey) {
    const params = new URLSearchParams({
      key: apiKey.trim(),
      q: `${lat},${lon}`,
      days: '2',
      aqi: 'yes',
      alerts: 'no',
      lang: 'vi',
    });
    const res = await fetch(`https://api.weatherapi.com/v1/forecast.json?${params.toString()}`);
    if (!res.ok) throw new Error(`WeatherAPI HTTP ${res.status}`);
    const data = await res.json();
    const cur = data.current || {};
    const isDay = (cur.is_day ?? 1) === 1;
    const temperatureC = Math.round((cur.temp_c ?? 26) * 10) / 10;
    const feelsLikeC = Math.round((cur.feelslike_c ?? temperatureC) * 10) / 10;
    const humidityPct = Math.round(cur.humidity ?? 70);
    const windSpeedKmh = Math.round((cur.wind_kph ?? 0) * 10) / 10;
    const windGustKmh = Math.max(windSpeedKmh, Math.round((cur.gust_kph ?? windSpeedKmh) * 10) / 10);
    const uvIndex = Math.max(0, Math.round((cur.uv ?? 0) * 10) / 10);
    const precipMmPerHr = Math.max(0, Math.round((cur.precip_mm ?? 0) * 100) / 100);

    const hours =
      (data.forecast &&
        data.forecast.forecastday &&
        data.forecast.forecastday[0] &&
        data.forecast.forecastday[0].hour) ||
      [];
    const hourly = hours.slice(0, 12).map((h) => ({
      timeIso: h.time || new Date().toISOString(),
      temperatureC: Math.round((h.temp_c ?? temperatureC) * 10) / 10,
      precipProbPct: Math.round(h.chance_of_rain ?? 0),
      precipMm: Math.round((h.precip_mm ?? 0) * 100) / 100,
      conditionCode: 'PARTLY_CLOUDY',
    }));

    return {
      provider: 'weatherapi',
      locationName,
      latitude: lat,
      longitude: lon,
      updatedAtIso: new Date().toISOString(),
      temperatureC,
      feelsLikeC,
      humidityPct,
      windSpeedKmh,
      windGustKmh,
      uvIndex,
      precipMmPerHr,
      precipProbPct: hourly[0] ? hourly[0].precipProbPct : 0,
      conditionText: (cur.condition && cur.condition.text) || (isDay ? 'Thời tiết dịu nhẹ' : 'Đêm mát mẻ'),
      isDay,
      hourly,
    };
  }

  async function fetchLiveWeatherWithFallback(cfg) {
    const lat = Number(cfg.latitude) || 21.0285;
    const lon = Number(cfg.longitude) || 105.8542;
    const locationName = cfg.locationName || 'Hà Nội';

    if (
      (cfg.provider === 'weatherapi' || cfg.provider === 'auto') &&
      cfg.weatherApiKey &&
      cfg.weatherApiKey.trim().length > 5
    ) {
      try {
        return await fetchWeatherApiCom(lat, lon, locationName, cfg.weatherApiKey);
      } catch {
        // Fallback to Open-Meteo Free
      }
    }

    return fetchOpenMeteoWeather(lat, lon, locationName);
  }

  async function reverseGeocodeVi(lat, lon) {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        lat
      )}&longitude=${encodeURIComponent(lon)}&localityLanguage=vi`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || data.city || '';
        const principal = data.principalSubdivision || '';
        if (locality && principal && locality !== principal) {
          return `${locality}, ${principal}`;
        }
        if (principal || locality) {
          return principal || locality;
        }
      }
    } catch {
      // Fallback
    }
    return `Vị trí (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
  }

  // ============================================================================
  // DOM HELPER UTILITIES (STRICTLY ZERO innerHTML)
  // ============================================================================

  function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string' || typeof text === 'number') {
      node.textContent = String(text);
    }
    return node;
  }

  function formatHourLabel(isoStr, idx) {
    if (!isoStr) return `+${idx + 1}h`;
    const match = String(isoStr).match(/T(\d{2}:\d{2})/);
    if (match) return match[1];
    const d = new Date(isoStr);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, '0')}:00`;
    }
    return `+${idx + 1}h`;
  }

  function resolveSpritePath(isStanding, gender, sceneId, npcAction) {
    const g = gender === 'female' ? 'female' : 'male';
    const file = isStanding
      ? `${g}_${sceneId}.png`
      : `npc_${g}_${npcAction}.png`;
    return `assets/characters/${file}`;
  }

  function resolveStandingMotionType(sceneId) {
    if (sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella') {
      return 'standing_wind';
    }
    if (sceneId === 'freezing_puffer' || sceneId === 'chilly_cozy') {
      return 'standing_shiver';
    }
    return 'standing_calm';
  }

  // ============================================================================
  // MAIN APPLICATION CONTROLLER
  // ============================================================================

  const state = {
    mode: document.body.getAttribute('data-mode') || 'newtab',
    config: Object.assign({}, DEFAULT_CONFIG),
    weather: null,
    decision: null,
    npcAction: ALL_NPC_ACTIONS[Math.floor(Math.random() * ALL_NPC_ACTIONS.length)],
    isStanding: false,
    standRemainingSec: 0,
    standTimerId: null,
    standTickId: null,
    npcRotationTimerId: null,
    weatherTimerId: null,
    clockTimerId: null,
    isLoadingWeather: false,
  };

  function showToast(msg) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = redactSecrets(msg);
    toast.classList.add('visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 4200);
  }

  function updateClockDom() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if (!timeEl && !dateEl) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    if (timeEl) timeEl.textContent = `${hh}:${mm}`;

    if (dateEl) {
      const daysVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = daysVi[now.getDay()];
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      dateEl.textContent = `${dayName}, ${d}/${m}/${y}`;
    }
  }

  function applyVisibilityToggles() {
    const cfg = state.config;
    document.body.classList.toggle('widget-compact', Boolean(cfg.compactMode));

    const clockCluster = document.getElementById('clock-cluster');
    if (clockCluster) {
      clockCluster.classList.toggle('hidden', !cfg.showClock || !cfg.enableNewTabOverride);
    }

    const searchForm = document.getElementById('search-form');
    if (searchForm) {
      searchForm.classList.toggle('hidden', !cfg.showSearch);
    }

    const searchBadge = document.getElementById('search-engine-badge');
    if (searchBadge) {
      searchBadge.textContent = cfg.searchEngine === 'duckduckgo' ? 'DuckDuckGo' : 'Google';
    }

    const mainBento = document.getElementById('main-bento-grid');
    const minimalBanner = document.getElementById('newtab-minimal-banner');
    if (state.mode === 'newtab' && mainBento) {
      mainBento.classList.toggle('hidden', !cfg.enableNewTabOverride);
      if (minimalBanner) {
        minimalBanner.classList.toggle('hidden', Boolean(cfg.enableNewTabOverride));
      }
    }

    const hourlySection = document.getElementById('hourly-section');
    if (hourlySection) {
      hourlySection.classList.toggle('hidden', !cfg.showHourly);
    }

    const metricsGrid = document.getElementById('metrics-grid');
    if (metricsGrid) {
      metricsGrid.classList.toggle('hidden', !cfg.showTelemetry);
    }
  }

  function renderCityStrip() {
    const container = document.getElementById('city-strip');
    if (!container) return;
    clearChildren(container);

    // 1-Tap Current Location GPS pill
    const gpsBtn = el(
      'button',
      `city-pill gps-pill${state.config.isGps ? ' active' : ''}`,
      '📍 Vị trí hiện tại'
    );
    gpsBtn.type = 'button';
    gpsBtn.title = 'Lấy tọa độ GPS thực tế và tên quận/thành phố';
    gpsBtn.addEventListener('click', () => handleSelectCurrentLocation());
    container.appendChild(gpsBtn);

    // 6 Preset Vietnam Cities
    const visibleCities =
      state.mode === 'popup' || state.mode === 'widget'
        ? PRESET_CITIES.slice(0, 4)
        : PRESET_CITIES;

    visibleCities.forEach((city) => {
      const isActive = !state.config.isGps && state.config.cityId === city.id;
      const btn = el('button', `city-pill${isActive ? ' active' : ''}`, city.nameVi);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.config.isGps = false;
        state.config.cityId = city.id;
        state.config.locationName = city.nameVi;
        state.config.latitude = city.latitude;
        state.config.longitude = city.longitude;
        saveConfig(state.config);
        renderCityStrip();
        refreshWeatherNow();
      });
      container.appendChild(btn);
    });
  }

  function renderNpcStage() {
    if (!state.weather || !state.decision) return;
    const decision = state.decision;
    const weather = state.weather;
    const cfg = state.config;

    document.documentElement.setAttribute('data-theme', decision.skyTheme);
    document.body.setAttribute('data-theme', decision.skyTheme);

    const badgeEl = document.getElementById('weather-badge-pill');
    if (badgeEl) badgeEl.textContent = decision.badgeVi;

    const npcModePill = document.getElementById('npc-mode-pill');
    const actionMeta = NPC_ACTION_META[state.npcAction] || NPC_ACTION_META.reading_book;
    if (npcModePill) {
      npcModePill.textContent = '';
      npcModePill.classList.add('hidden');
    }

    const rigPivot = document.getElementById('character-rig-pivot');
    const spriteImg = document.getElementById('character-sprite-img');
    const microAccent = document.getElementById('ambient-micro-accent');
    const tapHint = document.getElementById('tap-hint-pill');

    if (rigPivot) {
      const motionAttr = state.isStanding
        ? resolveStandingMotionType(decision.sceneId)
        : state.npcAction;
      rigPivot.setAttribute('data-motion', motionAttr);
    }

    if (spriteImg) {
      const nextSrc = resolveSpritePath(
        state.isStanding,
        cfg.gender,
        decision.sceneId,
        state.npcAction
      );
      if (spriteImg.getAttribute('src') !== nextSrc) {
        spriteImg.setAttribute('src', nextSrc);
      }
      const personaName = cfg.gender === 'female' ? 'Cô bé Nắng' : 'Cậu bé Mây';
      spriteImg.setAttribute(
        'alt',
        state.isStanding
          ? `${personaName} - ${decision.headlineVi}`
          : `${personaName} - ${actionMeta.labelVi}`
      );
    }

    if (microAccent) {
      if (state.isStanding) {
        microAccent.textContent =
          decision.sceneId === 'storm_raincoat' || decision.sceneId === 'light_rain_umbrella'
            ? '💧'
            : !weather.isDay
              ? '🌙'
              : '✨';
      } else {
        microAccent.textContent = actionMeta.accentIcon;
      }
    }

    if (tapHint) {
      tapHint.textContent = '';
      tapHint.classList.add('hidden');
    }

    const actionStrip = document.getElementById('npc-action-strip');
    if (actionStrip) {
      clearChildren(actionStrip);
      actionStrip.classList.add('hidden');
    }

    // Bottom Summary (Temp + Concise Headline + Outfit Advice)
    const heroTemp = document.getElementById('hero-temp');
    if (heroTemp) heroTemp.textContent = `${Math.round(weather.temperatureC)}°`;

    const feelsTag = document.getElementById('feels-like-tag');
    if (feelsTag) {
      feelsTag.textContent = `Cảm giác ${Math.round(weather.feelsLikeC)}°C · ${weather.conditionText}`;
    }

    const headlineEl = document.getElementById('decision-headline');
    if (headlineEl) headlineEl.textContent = decision.headlineVi;

    const outfitEl = document.getElementById('decision-outfit');
    if (outfitEl) outfitEl.textContent = decision.outfitAdviceVi;

    // Foresight Banners
    const alertsBox = document.getElementById('foresight-alerts');
    if (alertsBox) {
      clearChildren(alertsBox);
      if (decision.hasRainAheadProp && decision.rainAheadHours !== null) {
        const rainBanner = el(
          'div',
          'foresight-banner rain',
          `☂️ Dự báo có mưa sau ${decision.rainAheadHours} giờ tới · Nhớ mang sẵn ô`
        );
        alertsBox.appendChild(rainBanner);
      }
      if (decision.hasAqiMask) {
        const aqiBanner = el(
          'div',
          'foresight-banner aqi',
          `😷 Chỉ số AQI ${weather.aqi} · Nên đeo khẩu trang lọc bụi mịn`
        );
        alertsBox.appendChild(aqiBanner);
      }
    }
  }

  function renderTelemetryAndHourly() {
    if (!state.weather || !state.decision) return;
    const w = state.weather;

    const locTitle = document.getElementById('location-title');
    if (locTitle) locTitle.textContent = w.locationName;

    const locCoords = document.getElementById('location-coords');
    if (locCoords) {
      locCoords.textContent = `${Number(w.latitude).toFixed(2)}°N, ${Number(w.longitude).toFixed(2)}°E`;
    }

    const providerPill = document.getElementById('provider-pill');
    if (providerPill) {
      const labelMap = {
        open_meteo: 'Open-Meteo Live',
        weatherapi: 'WeatherAPI.com',
        tomorrow_io: 'Tomorrow.io',
        google: 'Google Weather',
      };
      providerPill.textContent = labelMap[w.provider] || 'Open-Meteo Live';
    }

    const metricsGrid = document.getElementById('metrics-grid');
    if (metricsGrid) {
      clearChildren(metricsGrid);
      const items = [
        {
          label: 'Lượng mưa & Xác suất',
          value: `${w.precipProbPct}%`,
          sub: `${w.precipMmPerHr} mm/h`,
        },
        {
          label: 'Sức gió & Gió giật',
          value: `${Math.round(w.windSpeedKmh)} km/h`,
          sub: `Giật ${Math.round(w.windGustKmh)} km/h`,
        },
        {
          label: 'Độ ẩm không khí',
          value: `${w.humidityPct}%`,
          sub: w.humidityPct >= 80 ? 'Ẩm cao' : 'Dễ chịu',
        },
        {
          label: w.isDay ? 'Chỉ số tia UV' : 'Trạng thái ban đêm',
          value: w.isDay ? `UV ${w.uvIndex}` : 'Đêm · UV 0',
          sub: !w.isDay
            ? 'Không cần chống nắng'
            : w.uvIndex >= 6
              ? 'Cần che chắn'
              : 'Mức an toàn',
        },
        {
          label: 'Chất lượng không khí',
          value: typeof w.aqi === 'number' ? `AQI ${w.aqi}` : 'AQI Tốt',
          sub: (w.aqi || 0) >= 130 ? 'Nên đeo khẩu trang' : 'Không khí ổn định',
        },
        {
          label: 'Cơ địa nhân vật',
          value:
            state.config.sensitivity === 'cold_sensitive'
              ? 'Sợ lạnh (-3°)'
              : state.config.sensitivity === 'heat_sensitive'
                ? 'Sợ nóng (+3°)'
                : 'Bình thường',
          sub: state.config.gender === 'female' ? 'Cô bé Nắng' : 'Cậu bé Mây',
        },
      ];

      items.forEach((m) => {
        const tile = el('div', 'metric-tile');
        tile.appendChild(el('div', 'metric-label', m.label));
        tile.appendChild(el('div', 'metric-value tabular', m.value));
        tile.appendChild(el('div', 'metric-sub', m.sub));
        metricsGrid.appendChild(tile);
      });
    }

    const hourlyStrip = document.getElementById('hourly-strip');
    if (hourlyStrip) {
      clearChildren(hourlyStrip);
      const points = (w.hourly || []).slice(0, 12);
      points.forEach((pt, idx) => {
        const card = el('div', 'hour-pill');
        card.appendChild(el('div', 'hour-time tabular', formatHourLabel(pt.timeIso, idx)));
        card.appendChild(el('div', 'hour-temp tabular', `${Math.round(pt.temperatureC)}°`));
        card.appendChild(el('div', 'hour-rain tabular', `${pt.precipProbPct}% mưa`));
        hourlyStrip.appendChild(card);
      });
    }

    // Update quick segmented buttons
    document.querySelectorAll('[data-gender-btn]').forEach((btn) => {
      const g = btn.getAttribute('data-gender-btn');
      btn.classList.toggle('active', g === state.config.gender);
    });
    document.querySelectorAll('[data-sens-btn]').forEach((btn) => {
      const s = btn.getAttribute('data-sens-btn');
      btn.classList.toggle('active', s === state.config.sensitivity);
    });
  }

  function syncSettingsFormFromConfig() {
    const cfg = state.config;
    const setChecked = (id, val) => {
      const node = document.getElementById(id);
      if (node) node.checked = Boolean(val);
    };
    const setVal = (id, val) => {
      const node = document.getElementById(id);
      if (node) node.value = val ?? '';
    };

    setChecked('chk-newtab-override', cfg.enableNewTabOverride);
    setChecked('chk-show-clock', cfg.showClock);
    setChecked('chk-show-search', cfg.showSearch);
    setChecked('chk-show-hourly', cfg.showHourly);
    setChecked('chk-show-telemetry', cfg.showTelemetry);
    setChecked('chk-auto-rotate-npc', cfg.autoRotateNpc);
    setChecked('chk-compact-mode', cfg.compactMode);
    setChecked('chk-always-on-top', cfg.alwaysOnTop);

    setVal('sel-gender', cfg.gender);
    setVal('sel-sensitivity', cfg.sensitivity);
    setVal('sel-search-engine', cfg.searchEngine);
    setVal('sel-widget-corner', cfg.widgetCorner);
    setVal('sel-widget-size', cfg.widgetSize);
    setVal('sel-provider', cfg.provider);

    setVal('inp-google-key', cfg.googleApiKey);
    setVal('inp-tomorrow-key', cfg.tomorrowApiKey);
    setVal('inp-weatherapi-key', cfg.weatherApiKey);
  }

  function clearStandTimers() {
    if (state.standTimerId) {
      clearTimeout(state.standTimerId);
      state.standTimerId = null;
    }
    if (state.standTickId) {
      clearInterval(state.standTickId);
      state.standTickId = null;
    }
  }

  function triggerStandUpPose() {
    clearStandTimers();
    state.isStanding = true;
    state.standRemainingSec = 9;

    const rigPivot = document.getElementById('character-rig-pivot');
    if (rigPivot) {
      rigPivot.classList.remove('stand-up-burst');
      void rigPivot.offsetWidth;
      rigPivot.classList.add('stand-up-burst');
      setTimeout(() => {
        rigPivot.classList.remove('stand-up-burst');
      }, 600);
    }

    renderNpcStage();

    const startedAt = Date.now();
    state.standTickId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remainMs = Math.max(0, NPC_STAND_DURATION_MS - elapsed);
      state.standRemainingSec = Math.ceil(remainMs / 1000);
      const npcModePill = document.getElementById('npc-mode-pill');
      if (npcModePill && state.isStanding) {
        npcModePill.textContent = `🧍 Trang phục thời tiết (${state.standRemainingSec}s)`;
      }
    }, 500);

    state.standTimerId = setTimeout(() => {
      clearStandTimers();
      state.isStanding = false;
      renderNpcStage();
    }, NPC_STAND_DURATION_MS);
  }

  function shuffleNpcAction() {
    clearStandTimers();
    state.isStanding = false;
    state.npcAction = pickNextRandomNpcAction(state.npcAction);
    renderNpcStage();
  }

  function restartNpcRotationTimer() {
    if (state.npcRotationTimerId) {
      clearInterval(state.npcRotationTimerId);
      state.npcRotationTimerId = null;
    }
    if (!state.config.autoRotateNpc) return;
    state.npcRotationTimerId = setInterval(() => {
      if (!state.isStanding) {
        state.npcAction = pickNextRandomNpcAction(state.npcAction);
        renderNpcStage();
      }
    }, NPC_ROTATION_INTERVAL_MS);
  }

  function recomputeDecisionAndRender() {
    if (!state.weather) return;
    const prevSceneId = state.decision ? state.decision.sceneId : null;
    state.decision = evaluateCharacterDecision(state.weather, {
      gender: state.config.gender,
      sensitivity: state.config.sensitivity,
    });
    const isRainScene =
      state.decision.sceneId === 'light_rain_umbrella' ||
      state.decision.sceneId === 'storm_raincoat';
    if (isRainScene) {
      clearStandTimers();
      state.isStanding = true;
    } else if (prevSceneId !== null && prevSceneId !== state.decision.sceneId) {
      triggerStandUpPose();
    }
    applyVisibilityToggles();
    renderCityStrip();
    renderNpcStage();
    renderTelemetryAndHourly();
    syncSettingsFormFromConfig();
  }

  async function refreshWeatherNow() {
    if (state.isLoadingWeather) return;
    state.isLoadingWeather = true;
    const refreshBtn = document.getElementById('btn-refresh-weather');
    if (refreshBtn) refreshBtn.textContent = '⏳ Đang tải...';

    try {
      const snapshot = await fetchLiveWeatherWithFallback(state.config);
      state.weather = snapshot;
      await saveWeatherCache(snapshot);
      recomputeDecisionAndRender();
    } catch (err) {
      showToast(`Đang dùng dữ liệu bộ nhớ đệm (${redactSecrets(err && err.message)})`);
    } finally {
      state.isLoadingWeather = false;
      if (refreshBtn) refreshBtn.textContent = '🔄 Làm mới';
    }
  }

  function handleSelectCurrentLocation() {
    if (!navigator.geolocation) {
      showToast('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    showToast('📍 Đang xác định tọa độ GPS độ chính xác cao...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        const nameVi = await reverseGeocodeVi(lat, lon);
        state.config.isGps = true;
        state.config.cityId = 'gps_current';
        state.config.latitude = lat;
        state.config.longitude = lon;
        state.config.locationName = nameVi;
        await saveConfig(state.config);
        showToast(`📍 Đã cập nhật: ${nameVi}`);
        await refreshWeatherNow();
      },
      (err) => {
        showToast(`Không thể lấy GPS (${err.message || 'Từ chối quyền'}). Hãy chọn thành phố.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  async function handleLaunchDesktopWidget() {
    const payload = {
      corner: state.config.widgetCorner || 'BottomRight',
      size: state.config.compactMode ? 'Compact' : state.config.widgetSize || 'Standard',
      gender: state.config.gender || 'male',
    };

    try {
      const res = await fetch('http://localhost:8787/api/pc-widget/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WeatherBuddy-Client': 'weatherbuddy-ui',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(`🚀 Đã mở Widget màn hình Windows tại góc ${payload.corner}!`);
        return;
      }
    } catch {
      // Fallback: open standalone borderless popup window right from browser
    }

    const width = payload.size === 'Compact' ? 310 : 388;
    const height = payload.size === 'Compact' ? 440 : 560;
    const availW = window.screen.availWidth || 1920;
    const availH = window.screen.availHeight || 1040;
    const margin = 16;

    let left = availW - width - margin;
    let top = availH - height - margin;
    if (payload.corner === 'TopRight') {
      top = margin;
    } else if (payload.corner === 'BottomLeft') {
      left = margin;
    } else if (payload.corner === 'TopLeft') {
      left = margin;
      top = margin;
    }

    const widgetUrl = `newtab.html?mode=widget&corner=${encodeURIComponent(
      payload.corner
    )}&size=${encodeURIComponent(payload.size)}&gender=${encodeURIComponent(payload.gender)}`;
    window.open(
      widgetUrl,
      'WeatherBuddyDesktopWidget',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );
    showToast('🖥️ Đã mở cửa sổ Widget nổi ở góc màn hình!');
  }

  function snapDesktopWidgetWindow(corner) {
    state.config.widgetCorner = corner;
    saveConfig(state.config);
    if (window.weatherBuddyDesktop && typeof window.weatherBuddyDesktop.snapCorner === 'function') {
      window.weatherBuddyDesktop.snapCorner(corner);
      showToast(`Đã ghim Widget vào góc ${corner}`);
      return;
    }
    try {
      const width = window.outerWidth || 380;
      const height = window.outerHeight || 540;
      const availW = window.screen.availWidth || 1920;
      const availH = window.screen.availHeight || 1040;
      const margin = 14;
      let left = availW - width - margin;
      let top = availH - height - margin;
      if (corner === 'TopRight') top = margin;
      if (corner === 'BottomLeft') left = margin;
      if (corner === 'TopLeft') {
        left = margin;
        top = margin;
      }
      window.moveTo(left, top);
      showToast(`Đã chuyển vị trí sang ${corner}`);
    } catch {
      // Ignore if browser restricts moveTo
    }
  }

  function wireDomEvents() {
    // Stage click -> Spring Stand-Up into weather outfit for 8.5s
    const stageViewport = document.getElementById('character-stage-viewport');
    if (stageViewport) {
      stageViewport.addEventListener('click', () => {
        triggerStandUpPose();
      });
    }

    // Shuffle NPC Action button
    const shuffleBtn = document.getElementById('btn-shuffle-npc');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        shuffleNpcAction();
      });
    }

    // Refresh weather button
    const refreshBtn = document.getElementById('btn-refresh-weather');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refreshWeatherNow());
    }

    // Control Drawer Open/Close
    const openDrawerBtn = document.getElementById('btn-open-settings');
    const closeDrawerBtn = document.getElementById('btn-close-settings');
    const backdrop = document.getElementById('drawer-backdrop');
    const drawer = document.getElementById('control-drawer');

    const toggleDrawer = (open) => {
      if (!drawer) return;
      drawer.classList.toggle('open', open);
      if (backdrop) backdrop.classList.toggle('open', open);
    };

    if (openDrawerBtn) openDrawerBtn.addEventListener('click', () => toggleDrawer(true));
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => toggleDrawer(false));
    if (backdrop) backdrop.addEventListener('click', () => toggleDrawer(false));

    // Restore New Tab override button when in minimal mode
    const restoreNewTabBtn = document.getElementById('btn-restore-newtab');
    if (restoreNewTabBtn) {
      restoreNewTabBtn.addEventListener('click', () => {
        state.config.enableNewTabOverride = true;
        saveConfig(state.config);
        recomputeDecisionAndRender();
      });
    }

    // Web Search Form (strictly Google or DuckDuckGo)
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchBadge = document.getElementById('search-engine-badge');

    if (searchBadge) {
      searchBadge.addEventListener('click', () => {
        state.config.searchEngine =
          state.config.searchEngine === 'duckduckgo' ? 'google' : 'duckduckgo';
        saveConfig(state.config);
        applyVisibilityToggles();
      });
    }

    if (searchForm && searchInput) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = (searchInput.value || '').trim();
        if (!q) return;
        const targetUrl =
          state.config.searchEngine === 'duckduckgo'
            ? `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
            : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        window.location.assign(targetUrl);
      });
    }

    // Quick Segmented Buttons (Gender & Sensitivity)
    document.querySelectorAll('[data-gender-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = btn.getAttribute('data-gender-btn');
        if (g === 'male' || g === 'female') {
          state.config.gender = g;
          saveConfig(state.config);
          recomputeDecisionAndRender();
        }
      });
    });

    document.querySelectorAll('[data-sens-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = btn.getAttribute('data-sens-btn');
        if (s === 'cold_sensitive' || s === 'normal' || s === 'heat_sensitive') {
          state.config.sensitivity = s;
          saveConfig(state.config);
          recomputeDecisionAndRender();
        }
      });
    });

    // Desktop Widget Header Controls
    const pinBtn = document.getElementById('widget-btn-pin');
    if (pinBtn) {
      pinBtn.addEventListener('click', () => {
        state.config.alwaysOnTop = !state.config.alwaysOnTop;
        pinBtn.classList.toggle('active', state.config.alwaysOnTop);
        saveConfig(state.config);
        if (
          window.weatherBuddyDesktop &&
          typeof window.weatherBuddyDesktop.setAlwaysOnTop === 'function'
        ) {
          window.weatherBuddyDesktop.setAlwaysOnTop(state.config.alwaysOnTop);
        }
        showToast(
          state.config.alwaysOnTop
            ? '📌 Đã bật Ghim nổi trên mọi cửa sổ'
            : 'Đã tắt Ghim nổi'
        );
      });
    }

    const sizeBtn = document.getElementById('widget-btn-size');
    if (sizeBtn) {
      sizeBtn.addEventListener('click', () => {
        state.config.compactMode = !state.config.compactMode;
        state.config.widgetSize = state.config.compactMode ? 'Compact' : 'Standard';
        saveConfig(state.config);
        applyVisibilityToggles();
        if (
          window.weatherBuddyDesktop &&
          typeof window.weatherBuddyDesktop.setSizeMode === 'function'
        ) {
          window.weatherBuddyDesktop.setSizeMode(state.config.widgetSize);
        } else {
          try {
            window.resizeTo(
              state.config.compactMode ? 310 : 388,
              state.config.compactMode ? 430 : 550
            );
          } catch {
            // Ignore
          }
        }
      });
    }

    document.querySelectorAll('[data-snap-corner]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = btn.getAttribute('data-snap-corner');
        if (c) snapDesktopWidgetWindow(c);
      });
    });

    // Settings Form Controls
    const bindCheckbox = (id, key) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener('change', () => {
        state.config[key] = Boolean(node.checked);
        if (key === 'compactMode') {
          state.config.widgetSize = node.checked ? 'Compact' : 'Standard';
        }
        saveConfig(state.config);
        if (key === 'autoRotateNpc') restartNpcRotationTimer();
        recomputeDecisionAndRender();
      });
    };

    bindCheckbox('chk-newtab-override', 'enableNewTabOverride');
    bindCheckbox('chk-show-clock', 'showClock');
    bindCheckbox('chk-show-search', 'showSearch');
    bindCheckbox('chk-show-hourly', 'showHourly');
    bindCheckbox('chk-show-telemetry', 'showTelemetry');
    bindCheckbox('chk-auto-rotate-npc', 'autoRotateNpc');
    bindCheckbox('chk-compact-mode', 'compactMode');
    bindCheckbox('chk-always-on-top', 'alwaysOnTop');

    const bindSelect = (id, key) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener('change', () => {
        state.config[key] = node.value;
        if (key === 'widgetSize') {
          state.config.compactMode = node.value === 'Compact';
        }
        saveConfig(state.config);
        recomputeDecisionAndRender();
      });
    };

    bindSelect('sel-gender', 'gender');
    bindSelect('sel-sensitivity', 'sensitivity');
    bindSelect('sel-search-engine', 'searchEngine');
    bindSelect('sel-widget-corner', 'widgetCorner');
    bindSelect('sel-widget-size', 'widgetSize');
    bindSelect('sel-provider', 'provider');

    // Save User API Keys Button
    const saveKeysBtn = document.getElementById('btn-save-api-keys');
    if (saveKeysBtn) {
      saveKeysBtn.addEventListener('click', async () => {
        const gKey = document.getElementById('inp-google-key');
        const tKey = document.getElementById('inp-tomorrow-key');
        const wKey = document.getElementById('inp-weatherapi-key');

        state.config.googleApiKey = gKey ? gKey.value.trim() : '';
        state.config.tomorrowApiKey = tKey ? tKey.value.trim() : '';
        state.config.weatherApiKey = wKey ? wKey.value.trim() : '';

        await saveConfig(state.config);
        showToast('🔒 Đã lưu cấu hình API Key cá nhân an toàn vào bộ nhớ cục bộ.');
        await refreshWeatherNow();
      });
    }

    // Show/Hide Password Toggles for API Key Inputs
    document.querySelectorAll('[data-toggle-secret]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-secret');
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;
        const isMasked = input.getAttribute('type') === 'password';
        input.setAttribute('type', isMasked ? 'text' : 'password');
        btn.textContent = isMasked ? '🙈 Ẩn' : '👁️ Hiện';
      });
    });

    // Clear All API Keys Button
    const clearKeysBtn = document.getElementById('btn-clear-api-keys');
    if (clearKeysBtn) {
      clearKeysBtn.addEventListener('click', async () => {
        state.config.googleApiKey = '';
        state.config.tomorrowApiKey = '';
        state.config.weatherApiKey = '';
        state.config.provider = 'open_meteo';
        await saveConfig(state.config);
        syncSettingsFormFromConfig();
        showToast('Đã xóa toàn bộ API Key cá nhân · Chuyển về Open-Meteo Free.');
        await refreshWeatherNow();
      });
    }

    // Launch Desktop Widget Button
    document.querySelectorAll('[data-action-launch-widget]').forEach((btn) => {
      btn.addEventListener('click', () => handleLaunchDesktopWidget());
    });

    // Export JSON Config (Excludes raw API keys by default for safe sharing!)
    const exportBtn = document.getElementById('btn-export-config');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const safeConfig = Object.assign({}, state.config, {
          googleApiKey: '',
          tomorrowApiKey: '',
          weatherApiKey: '',
        });
        const blob = new Blob([JSON.stringify(safeConfig, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'weatherbuddy-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('📋 Đã xuất tệp cấu hình (đã ẩn API Key bảo mật).');
      });
    }

    // Import JSON Config
    const importBtn = document.getElementById('btn-import-config');
    const importFile = document.getElementById('inp-import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const parsed = JSON.parse(String(reader.result || '{}'));
            state.config = Object.assign({}, DEFAULT_CONFIG, state.config, parsed);
            await saveConfig(state.config);
            recomputeDecisionAndRender();
            showToast('📂 Đã nhập cấu hình WeatherBuddy thành công!');
            await refreshWeatherNow();
          } catch {
            showToast('Tệp JSON không hợp lệ.');
          }
        };
        reader.readAsText(file);
      });
    }
  }

  async function bootstrap() {
    // Allow ?mode=widget override when launched in --app borderless window
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'widget') {
        state.mode = 'widget';
        document.body.setAttribute('data-mode', 'widget');
      }
    } catch {
      // Ignore
    }

    state.config = await loadConfig();

    // Instant fallback weather while live fetch completes
    const cached = await loadWeatherCache();
    if (cached && cached.snapshot) {
      state.weather = cached.snapshot;
    } else {
      const nowHour = new Date().getHours();
      const isDay = nowHour >= 6 && nowHour < 18;
      state.weather = {
        provider: 'open_meteo',
        locationName: state.config.locationName || 'Hà Nội',
        latitude: state.config.latitude,
        longitude: state.config.longitude,
        updatedAtIso: new Date().toISOString(),
        temperatureC: 26,
        feelsLikeC: 27,
        humidityPct: 72,
        windSpeedKmh: 11,
        windGustKmh: 16,
        uvIndex: isDay ? 5 : 0,
        precipMmPerHr: 0,
        precipProbPct: 15,
        conditionText: isDay ? 'Trời nắng dịu' : 'Đêm thoáng mát',
        isDay,
        aqi: 52,
        hourly: [],
      };
    }

    wireDomEvents();
    updateClockDom();
    state.clockTimerId = setInterval(updateClockDom, 15000);

    recomputeDecisionAndRender();
    restartNpcRotationTimer();

    await refreshWeatherNow();
    state.weatherTimerId = setInterval(refreshWeatherNow, WEATHER_REFRESH_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
