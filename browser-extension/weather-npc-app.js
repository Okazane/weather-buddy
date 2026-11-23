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
  const NPC_OUTFIT_SHOWCASE_MS = 5500;
  const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
  const SVG_NS = 'http://www.w3.org/2000/svg';

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

  function svgEl(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const val = attrs[k];
        if (val !== undefined && val !== null) {
          node.setAttribute(k, String(val));
        }
      });
    }
    if (Array.isArray(children)) {
      children.forEach((c) => {
        if (c) node.appendChild(c);
      });
    }
    return node;
  }

  function getCanonicalOutfitSpec(gender, sceneId) {
    const isFemale = gender === 'female';
    switch (sceneId) {
      case 'storm_raincoat':
        return {
          topLight: '#FFF078',
          topMid: '#FACC15',
          topDark: '#CA8A04',
          collarColor: '#FEF08A',
          accentColor: '#EA580C',
          bottomLight: '#334155',
          bottomDark: '#1E293B',
          shoeMain: '#FACC15',
          shoeAccent: '#A16207',
          isDress: false,
          isRaincoat: true,
          isPuffer: false,
          isCardigan: false,
          hasSunglasses: false,
          hasSunVisor: false,
          hasEarmuffs: false,
          hasScarf: false,
          hasUmbrella: false,
          umbrellaColor: '#93C5FD',
          hasNightStarBadge: false,
        };
      case 'light_rain_umbrella':
        return isFemale
          ? {
              topLight: '#FFE0EC',
              topMid: '#F9A8C9',
              topDark: '#DB709B',
              collarColor: '#FFF1F5',
              accentColor: '#F43F5E',
              bottomLight: '#FFFBEB',
              bottomDark: '#FDE68A',
              shoeMain: '#F472B6',
              shoeAccent: '#FFF1F5',
              isDress: true,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: true,
              umbrellaColor: '#F9A8D4',
              hasNightStarBadge: false,
            }
          : {
              topLight: '#D1FAE5',
              topMid: '#6EE7B7',
              topDark: '#059669',
              collarColor: '#ECFEFF',
              accentColor: '#0D9488',
              bottomLight: '#334155',
              bottomDark: '#1E293B',
              shoeMain: '#34D399',
              shoeAccent: '#ECFDF5',
              isDress: false,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: true,
              umbrellaColor: '#6EE7B7',
              hasNightStarBadge: false,
            };
      case 'hot_sunny':
        return isFemale
          ? {
              topLight: '#FFE4E6',
              topMid: '#FDA4AF',
              topDark: '#F43F5E',
              collarColor: '#FFF1F2',
              accentColor: '#FB7185',
              bottomLight: '#FFE4E6',
              bottomDark: '#FB7185',
              shoeMain: '#FFF1F2',
              shoeAccent: '#F43F5E',
              isDress: true,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: true,
              hasSunVisor: true,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#FDA4AF',
              hasNightStarBadge: false,
            }
          : {
              topLight: '#FFEDD5',
              topMid: '#FB923C',
              topDark: '#EA580C',
              collarColor: '#FFFFFF',
              accentColor: '#F97316',
              bottomLight: '#FDE68A',
              bottomDark: '#D97706',
              shoeMain: '#FFFFFF',
              shoeAccent: '#FB923C',
              isDress: false,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: true,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#93C5FD',
              hasNightStarBadge: false,
            };
      case 'clear_night':
        return isFemale
          ? {
              topLight: '#EDE9FE',
              topMid: '#C4B5FD',
              topDark: '#7C3AED',
              collarColor: '#F5F3FF',
              accentColor: '#FDE047',
              bottomLight: '#EDE9FE',
              bottomDark: '#A78BFA',
              shoeMain: '#F5F3FF',
              shoeAccent: '#8B5CF6',
              isDress: true,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#C4B5FD',
              hasNightStarBadge: true,
            }
          : {
              topLight: '#DBEAFE',
              topMid: '#93C5FD',
              topDark: '#2563EB',
              collarColor: '#EFF6FF',
              accentColor: '#FDE047',
              bottomLight: '#475569',
              bottomDark: '#334155',
              shoeMain: '#F1F5F9',
              shoeAccent: '#60A5FA',
              isDress: false,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#93C5FD',
              hasNightStarBadge: true,
            };
      case 'chilly_cozy':
        return isFemale
          ? {
              topLight: '#FFF1F2',
              topMid: '#FDA4AF',
              topDark: '#E11D48',
              collarColor: '#FFFBEB',
              accentColor: '#9F1239',
              bottomLight: '#D97706',
              bottomDark: '#92400E',
              shoeMain: '#92400E',
              shoeAccent: '#FDE68A',
              isDress: true,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: true,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#FECDD3',
              hasNightStarBadge: false,
            }
          : {
              topLight: '#FEF9C3',
              topMid: '#FDE047',
              topDark: '#CA8A04',
              collarColor: '#E0F2FE',
              accentColor: '#854D0E',
              bottomLight: '#B45309',
              bottomDark: '#78350F',
              shoeMain: '#78350F',
              shoeAccent: '#FDE68A',
              isDress: false,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: true,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#93C5FD',
              hasNightStarBadge: false,
            };
      case 'freezing_puffer':
        return isFemale
          ? {
              topLight: '#F3E8FF',
              topMid: '#D8B4FE',
              topDark: '#9333EA',
              collarColor: '#FFFBEB',
              accentColor: '#7E22CE',
              bottomLight: '#334155',
              bottomDark: '#1E293B',
              shoeMain: '#78350F',
              shoeAccent: '#FFFBEB',
              isDress: false,
              isRaincoat: false,
              isPuffer: true,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: true,
              hasScarf: true,
              hasUmbrella: false,
              umbrellaColor: '#D8B4FE',
              hasNightStarBadge: false,
            }
          : {
              topLight: '#E0F2FE',
              topMid: '#7DD3FC',
              topDark: '#0284C7',
              collarColor: '#FFFBEB',
              accentColor: '#E11D48',
              bottomLight: '#1E293B',
              bottomDark: '#0F172A',
              shoeMain: '#475569',
              shoeAccent: '#E2E8F0',
              isDress: false,
              isRaincoat: false,
              isPuffer: true,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: true,
              hasScarf: true,
              hasUmbrella: false,
              umbrellaColor: '#7DD3FC',
              hasNightStarBadge: false,
            };
      case 'pleasant_sunny':
      default:
        return isFemale
          ? {
              topLight: '#FEF9C3',
              topMid: '#FDE047',
              topDark: '#EAB308',
              collarColor: '#FFFFFF',
              accentColor: '#F59E0B',
              bottomLight: '#FEF08A',
              bottomDark: '#CA8A04',
              shoeMain: '#FFFFFF',
              shoeAccent: '#FACC15',
              isDress: true,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#FDE047',
              hasNightStarBadge: false,
            }
          : {
              topLight: '#E0F2FE',
              topMid: '#7DD3FC',
              topDark: '#0284C7',
              collarColor: '#FFFFFF',
              accentColor: '#0EA5E9',
              bottomLight: '#64748B',
              bottomDark: '#334155',
              shoeMain: '#FFFFFF',
              shoeAccent: '#38BDF8',
              isDress: false,
              isRaincoat: false,
              isPuffer: false,
              isCardigan: false,
              hasSunglasses: false,
              hasSunVisor: false,
              hasEarmuffs: false,
              hasScarf: false,
              hasUmbrella: false,
              umbrellaColor: '#7DD3FC',
              hasNightStarBadge: false,
            };
    }
  }

  /**
   * Builds a pure-DOM Canonical Articulated Chibi SVG Rig (ZERO innerHTML!) with:
   * - Strict mathematical anatomy landmarks locked across male & female & all 7 weather scenes:
   *   Crown Y = 63, Eye Axis Y = 127, Chin Y = 172, Shoulders (128, 184) & (192, 184),
   *   Hip Baseline Y = 234, Boot Sole Bottom Y = 281.
   * - Signature hairstyles (Cậu bé Mây's chestnut bangs + cowlick; Cô bé Nắng's wispy bangs + twin-buns)
   *   ALWAYS visible across all 7 weather states (including storm_raincoat hood pouches, visor, earmuffs).
   * - Modular weather outfit ALWAYS worn in both Standing and all 5 NPC activities.
   */
  function buildCanonicalChibiRigDom(gender, sceneId, npcAction) {
    const isFemale = gender === 'female';
    const outfit = getCanonicalOutfitSpec(gender, sceneId);

    const defs = svgEl('defs', null, [
      svgEl('radialGradient', { id: 'wbSkinGrad', cx: '50%', cy: '40%', r: '62%' }, [
        svgEl('stop', { offset: '0%', 'stop-color': '#FFF3EB' }),
        svgEl('stop', { offset: '72%', 'stop-color': '#FDE1D3' }),
        svgEl('stop', { offset: '100%', 'stop-color': '#F5C4B0' }),
      ]),
      svgEl('linearGradient', { id: 'wbHairGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, [
        svgEl('stop', { offset: '0%', 'stop-color': isFemale ? '#9C5B3C' : '#7C4A2D' }),
        svgEl('stop', { offset: '100%', 'stop-color': isFemale ? '#61341F' : '#4A2816' }),
      ]),
      svgEl('radialGradient', { id: 'wbIrisGrad', cx: '50%', cy: '35%', r: '65%' }, [
        svgEl('stop', { offset: '0%', 'stop-color': '#5C3422' }),
        svgEl('stop', { offset: '65%', 'stop-color': '#3A1E13' }),
        svgEl('stop', { offset: '100%', 'stop-color': '#21100A' }),
      ]),
      svgEl('radialGradient', { id: 'wbCheekGrad', cx: '50%', cy: '50%', r: '50%' }, [
        svgEl('stop', { offset: '0%', 'stop-color': '#FB7185', 'stop-opacity': '0.48' }),
        svgEl('stop', { offset: '100%', 'stop-color': '#FB7185', 'stop-opacity': '0' }),
      ]),
      svgEl('linearGradient', { id: 'wbTopGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, [
        svgEl('stop', { offset: '0%', 'stop-color': outfit.topLight }),
        svgEl('stop', { offset: '52%', 'stop-color': outfit.topMid }),
        svgEl('stop', { offset: '100%', 'stop-color': outfit.topDark }),
      ]),
      svgEl('linearGradient', { id: 'wbBotGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, [
        svgEl('stop', { offset: '0%', 'stop-color': outfit.bottomLight }),
        svgEl('stop', { offset: '100%', 'stop-color': outfit.bottomDark }),
      ]),
    ]);

    const groundShadow = svgEl('ellipse', {
      cx: 160,
      cy: 284,
      rx: 46,
      ry: 8.5,
      fill: '#0F172A',
      opacity: 0.18,
    });

    // Ambient sun/moon charm
    let skyCharmG = null;
    if (sceneId === 'pleasant_sunny' || sceneId === 'hot_sunny') {
      const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) =>
        svgEl('line', {
          x1: 0,
          y1: -12.5,
          x2: 0,
          y2: -16,
          stroke: '#FACC15',
          'stroke-width': 2.3,
          'stroke-linecap': 'round',
          transform: `rotate(${deg})`,
        })
      );
      skyCharmG = svgEl('g', { transform: `translate(${isFemale ? 236 : 84}, 72)` }, [
        svgEl('circle', { cx: 0, cy: 0, r: 14, fill: '#FDE047', opacity: 0.3 }),
        svgEl('circle', { cx: 0, cy: 0, r: 9.2, fill: '#FACC15' }),
        ...rays,
      ]);
    } else if (sceneId === 'clear_night') {
      skyCharmG = svgEl('g', { transform: `translate(${isFemale ? 234 : 86}, 74)` }, [
        svgEl('path', {
          d: 'M 4 -10 A 11 11 0 1 0 12 8 A 8.5 8.5 0 1 1 4 -10 Z',
          fill: '#FDE047',
        }),
        svgEl('circle', { cx: -9, cy: -8, r: 2, fill: '#FEF08A' }),
      ]);
    }

    // Umbrella canopy (behind body in light_rain_umbrella)
    let umbrellaG = null;
    if (outfit.hasUmbrella) {
      umbrellaG = svgEl('g', { transform: 'translate(168, 84) rotate(8)' }, [
        svgEl('line', {
          x1: 0,
          y1: -18,
          x2: -6,
          y2: 96,
          stroke: '#94A3B8',
          'stroke-width': 3.2,
          'stroke-linecap': 'round',
        }),
        svgEl('path', {
          d: 'M -6 96 Q -6 104 -14 104 Q -20 104 -20 97',
          stroke: outfit.topDark,
          'stroke-width': 3.8,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
        svgEl('path', {
          d: 'M -76 16 C -72 -42, 72 -42, 76 16 Q 50 6 25 16 Q 0 6 -25 16 Q -50 6 -76 16 Z',
          fill: outfit.umbrellaColor,
          'fill-opacity': 0.8,
          stroke: '#FFFFFF',
          'stroke-width': 2,
        }),
        svgEl('circle', { cx: 0, cy: -30, r: 3.5, fill: '#FFFFFF' }),
      ]);
    }

    // Female Twin-Buns (ALWAYS visible — framed by yellow hood pouches in storm_raincoat!)
    let twinBunsRootG = null;
    let bunLeftG = null;
    let bunRightG = null;
    if (isFemale) {
      bunLeftG = svgEl('g', { transform: 'translate(-45, -38)' }, [
        outfit.isRaincoat
          ? svgEl('circle', {
              cx: -1,
              cy: -1,
              r: 24.5,
              fill: '#FACC15',
              stroke: '#CA8A04',
              'stroke-width': 1.5,
            })
          : null,
        svgEl('circle', { cx: 0, cy: 0, r: 20.5, fill: 'url(#wbHairGrad)' }),
        svgEl('circle', { cx: -5, cy: -6, r: 6, fill: '#C68660', opacity: 0.36 }),
        svgEl('circle', { cx: 12, cy: 9, r: 4.4, fill: '#FDE047' }),
      ]);
      bunRightG = svgEl('g', { transform: 'translate(45, -38)' }, [
        outfit.isRaincoat
          ? svgEl('circle', {
              cx: 1,
              cy: -1,
              r: 24.5,
              fill: '#FACC15',
              stroke: '#CA8A04',
              'stroke-width': 1.5,
            })
          : null,
        svgEl('circle', { cx: 0, cy: 0, r: 20.5, fill: 'url(#wbHairGrad)' }),
        svgEl('circle', { cx: -5, cy: -6, r: 6, fill: '#C68660', opacity: 0.36 }),
        svgEl('circle', { cx: -12, cy: 9, r: 4.4, fill: '#FDA4AF' }),
      ]);
      twinBunsRootG = svgEl('g', { transform: 'translate(160, 118)' }, [bunLeftG, bunRightG]);
    }

    // Standing Legs: Hip Baseline Y = 234, Sole Bottom Y = 234 + 47 = 281 (exact lock!)
    const standLeftLeg = svgEl('g', { transform: 'translate(145, 234)' }, [
      svgEl('rect', { x: -9.5, y: 0, width: 19, height: 38, rx: 9.5, fill: 'url(#wbSkinGrad)' }),
      !outfit.isDress
        ? svgEl('rect', { x: -11, y: -2, width: 22, height: 24, rx: 8, fill: 'url(#wbBotGrad)' })
        : null,
      svgEl('rect', { x: -9.6, y: 24, width: 19.2, height: 7, rx: 3, fill: '#FFFFFF' }),
      svgEl('path', {
        d: 'M -12 29 L 11 29 Q 15 29 15 40 Q 15 47 0 47 L -10 47 Q -15 47 -15 39 Z',
        fill: outfit.shoeMain,
      }),
      svgEl('rect', { x: -13, y: 42, width: 27, height: 5, rx: 2.5, fill: outfit.shoeAccent }),
    ]);

    const standRightLeg = svgEl('g', { transform: 'translate(175, 234)' }, [
      svgEl('rect', { x: -9.5, y: 0, width: 19, height: 38, rx: 9.5, fill: 'url(#wbSkinGrad)' }),
      !outfit.isDress
        ? svgEl('rect', { x: -11, y: -2, width: 22, height: 24, rx: 8, fill: 'url(#wbBotGrad)' })
        : null,
      svgEl('rect', { x: -9.6, y: 24, width: 19.2, height: 7, rx: 3, fill: '#FFFFFF' }),
      svgEl('path', {
        d: 'M -11 29 L 12 29 Q 16 29 16 40 Q 16 47 2 47 L -9 47 Q -14 47 -14 39 Z',
        fill: outfit.shoeMain,
      }),
      svgEl('rect', { x: -12, y: 42, width: 27, height: 5, rx: 2.5, fill: outfit.shoeAccent }),
    ]);
    const standLegsG = svgEl('g', null, [standLeftLeg, standRightLeg]);

    // Seated NPC Legs
    const sitShoeL = svgEl('g', { transform: 'translate(132, 270) rotate(-8)' }, [
      svgEl('ellipse', {
        cx: 0,
        cy: 0,
        rx: 14,
        ry: 9.2,
        fill: outfit.shoeMain,
        stroke: outfit.shoeAccent,
        'stroke-width': 2,
      }),
    ]);
    const sitShoeR = svgEl('g', { transform: 'translate(188, 270) rotate(8)' }, [
      svgEl('ellipse', {
        cx: 0,
        cy: 0,
        rx: 14,
        ry: 9.2,
        fill: outfit.shoeMain,
        stroke: outfit.shoeAccent,
        'stroke-width': 2,
      }),
    ]);
    const sitLegsG = svgEl('g', { display: 'none' }, [
      svgEl('path', {
        d: 'M 132 238 Q 114 248 119 264 Q 127 273 152 268',
        stroke: 'url(#wbBotGrad)',
        'stroke-width': 18.5,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
      svgEl('path', {
        d: 'M 188 238 Q 206 248 201 264 Q 193 273 168 268',
        stroke: 'url(#wbBotGrad)',
        'stroke-width': 18.5,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
      sitShoeL,
      sitShoeR,
    ]);

    // Helper for Articulated Arm at Canonical Shoulder Joint (128, 184) & (192, 184)
    function makeArm(side) {
      const sx = side === 'left' ? 128 : 192;
      const sleeveFill = outfit.isRaincoat
        ? '#FACC15'
        : outfit.isPuffer
          ? outfit.topMid
          : 'url(#wbTopGrad)';
      return svgEl('g', { transform: `translate(${sx}, 184) rotate(0)` }, [
        svgEl('circle', { cx: 0, cy: 0, r: 9.5, fill: sleeveFill }),
        svgEl('rect', { x: -8.5, y: 0, width: 17, height: 30, rx: 8.5, fill: sleeveFill }),
        svgEl('circle', {
          cx: 0,
          cy: 33,
          r: 7.5,
          fill: outfit.isPuffer ? outfit.accentColor : 'url(#wbSkinGrad)',
        }),
      ]);
    }

    const leftArmG = makeArm('left');
    const rightArmG = makeArm('right');

    // Canonical Calibrated Torso Silhouette (tight ±3–5px garment thickness, y = 173..238)
    const torsoChildren = [];
    if (outfit.isRaincoat) {
      torsoChildren.push(
        svgEl('path', {
          d: 'M 125 173 Q 160 167 195 173 L 203 239 Q 160 246 117 239 Z',
          fill: 'url(#wbTopGrad)',
        }),
        svgEl('path', {
          d: 'M 120 233 Q 160 240 200 233',
          stroke: '#FEF08A',
          'stroke-width': 4,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
        svgEl('line', { x1: 160, y1: 175, x2: 160, y2: 240, stroke: '#CA8A04', 'stroke-width': 1.8 }),
        svgEl('rect', { x: 154, y: 193, width: 12, height: 4.5, rx: 2.2, fill: '#FFFBEB', stroke: '#B45309', 'stroke-width': 1 }),
        svgEl('rect', { x: 154, y: 211, width: 12, height: 4.5, rx: 2.2, fill: '#FFFBEB', stroke: '#B45309', 'stroke-width': 1 })
      );
    } else if (outfit.isPuffer) {
      torsoChildren.push(
        svgEl('rect', { x: 123, y: 173, width: 74, height: 65, rx: 24, fill: 'url(#wbTopGrad)' }),
        svgEl('path', {
          d: 'M 135 174 Q 160 184 185 174',
          stroke: '#FFFBEB',
          'stroke-width': 6.5,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
        svgEl('line', { x1: 160, y1: 178, x2: 160, y2: 237, stroke: '#FFFFFF', 'stroke-opacity': 0.6, 'stroke-width': 1.8 }),
        svgEl('path', {
          d: 'M 126 195 Q 160 201 194 195 M 125 216 Q 160 222 195 216',
          stroke: '#FFFFFF',
          'stroke-opacity': 0.52,
          'stroke-width': 2,
          fill: 'none',
        })
      );
    } else if (outfit.isDress) {
      torsoChildren.push(
        svgEl('path', {
          d: 'M 126 173 Q 160 168 194 173 L 202 239 Q 160 246 118 239 Z',
          fill: 'url(#wbTopGrad)',
        }),
        svgEl('path', {
          d: 'M 121 233 Q 160 240 199 233',
          stroke: outfit.collarColor,
          'stroke-opacity': 0.75,
          'stroke-width': 2.3,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
        outfit.isCardigan
          ? svgEl('path', { d: 'M 149 174 L 146 239 L 174 239 L 171 174 Z', fill: outfit.collarColor })
          : null,
        svgEl('path', {
          d: 'M 143 174 Q 151 185 160 178 Q 169 185 177 174',
          stroke: outfit.collarColor,
          'stroke-width': 4.6,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
        svgEl('circle', { cx: 160, cy: 182, r: 3.4, fill: outfit.accentColor })
      );
    } else {
      torsoChildren.push(
        svgEl('rect', { x: 126, y: 173, width: 68, height: 64, rx: 20, fill: 'url(#wbTopGrad)' }),
        outfit.isCardigan
          ? svgEl('path', { d: 'M 148 174 L 160 200 L 172 174 Z', fill: outfit.collarColor })
          : svgEl('path', {
              d: 'M 144 174 Q 160 185 176 174',
              stroke: outfit.collarColor,
              'stroke-width': 4.6,
              'stroke-linecap': 'round',
              fill: 'none',
            }),
        outfit.hasNightStarBadge
          ? svgEl('circle', { cx: 173, cy: 198, r: 4.2, fill: '#FDE047' })
          : svgEl('circle', { cx: 173, cy: 198, r: 3.8, fill: '#FFFFFF', opacity: 0.8 })
      );
    }

    let scarfTailG = null;
    if (outfit.hasScarf) {
      scarfTailG = svgEl('g', { transform: 'translate(16, 4) rotate(-14)' }, [
        svgEl('rect', {
          x: -7,
          y: 0,
          width: 14.5,
          height: 31,
          rx: 5.5,
          fill: isFemale ? '#FEF3C7' : '#FB7185',
        }),
      ]);
      torsoChildren.push(
        svgEl('g', { transform: 'translate(160, 174)' }, [
          svgEl('rect', {
            x: -29,
            y: -6.5,
            width: 58,
            height: 17.5,
            rx: 8.8,
            fill: isFemale ? '#FFFBEB' : '#F43F5E',
            stroke: isFemale ? '#FDE68A' : '#BE123C',
            'stroke-width': 1.2,
          }),
          scarfTailG,
        ])
      );
    }
    const torsoG = svgEl('g', null, torsoChildren);

    // Held NPC Center Prop (Book / Phone)
    const propG = svgEl('g', { display: 'none' });
    if (npcAction === 'reading_book') {
      propG.appendChild(
        svgEl('g', { transform: 'translate(160, 224)' }, [
          svgEl('path', {
            d: 'M -26 -8 Q -13 -13 0 -6 Q 13 -13 26 -8 L 24 14 Q 12 9 0 15 Q -12 9 -24 14 Z',
            fill: '#FFFBEB',
            stroke: '#D97706',
            'stroke-width': 2.2,
          }),
          svgEl('line', { x1: 0, y1: -6, x2: 0, y2: 15, stroke: '#B45309', 'stroke-width': 1.8 }),
        ])
      );
    } else if (npcAction === 'scrolling_phone') {
      propG.appendChild(
        svgEl('g', { transform: 'translate(160, 220) rotate(-8)' }, [
          svgEl('rect', {
            x: -11,
            y: -16,
            width: 22,
            height: 32,
            rx: 5,
            fill: '#1E293B',
            stroke: '#94A3B8',
            'stroke-width': 1.6,
          }),
          svgEl('rect', { x: -8.5, y: -12, width: 17, height: 24, rx: 3, fill: '#38BDF8', opacity: 0.85 }),
        ])
      );
    }

    // Canonical Head & Living Gaze Eyes (Centered at 160, 122 -> Crown 63, Eyes 127, Chin 172)
    const browL = svgEl('path', {
      d: 'M -31 -11 Q -22 -15.5 -13 -11',
      stroke: '#5A331F',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      fill: 'none',
    });
    const browR = svgEl('path', {
      d: 'M 13 -11 Q 22 -15.5 31 -11',
      stroke: '#5A331F',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      fill: 'none',
    });

    const squintL = svgEl('path', {
      d: 'M -32 6 Q -22 10.5 -12 6',
      stroke: '#2B160F',
      'stroke-width': 3.5,
      'stroke-linecap': 'round',
      fill: 'none',
    });
    const squintR = svgEl('path', {
      d: 'M 12 6 Q 22 10.5 32 6',
      stroke: '#2B160F',
      'stroke-width': 3.5,
      'stroke-linecap': 'round',
      fill: 'none',
    });
    const squintEyesG = svgEl('g', { display: 'none' }, [squintL, squintR]);

    const pupilLG = svgEl('g', null, [
      svgEl('ellipse', { cx: -21.5, cy: 5.5, rx: 8.8, ry: 9.8, fill: 'url(#wbIrisGrad)' }),
      svgEl('path', {
        d: 'M -27 9 Q -21.5 14 -16 9',
        stroke: '#F59E0B',
        'stroke-opacity': 0.55,
        'stroke-width': 2.4,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
      svgEl('circle', { cx: -21.5, cy: 5.5, r: 4.5, fill: '#1C0D08' }),
      svgEl('circle', { cx: -25, cy: 1.6, r: 3.3, fill: '#FFFFFF' }),
      svgEl('circle', { cx: -18, cy: 9.4, r: 1.6, fill: '#FFFFFF', opacity: 0.92 }),
    ]);

    const pupilRG = svgEl('g', null, [
      svgEl('ellipse', { cx: 21.5, cy: 5.5, rx: 8.8, ry: 9.8, fill: 'url(#wbIrisGrad)' }),
      svgEl('path', {
        d: 'M 16 9 Q 21.5 14 27 9',
        stroke: '#F59E0B',
        'stroke-opacity': 0.55,
        'stroke-width': 2.4,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
      svgEl('circle', { cx: 21.5, cy: 5.5, r: 4.5, fill: '#1C0D08' }),
      svgEl('circle', { cx: 18, cy: 1.6, r: 3.3, fill: '#FFFFFF' }),
      svgEl('circle', { cx: 25, cy: 9.4, r: 1.6, fill: '#FFFFFF', opacity: 0.92 }),
    ]);

    const openEyesG = svgEl('g', null, [
      svgEl('ellipse', { cx: -22, cy: 5, rx: 11.8, ry: 12.8, fill: '#FFFFFF' }),
      pupilLG,
      svgEl('path', {
        d: isFemale ? 'M -34 3 Q -22 -9.5 -11 2 L -36.5 0.8' : 'M -33.5 3 Q -22 -8.5 -11 3',
        stroke: '#2A150E',
        'stroke-width': 3.3,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
      svgEl('ellipse', { cx: 22, cy: 5, rx: 11.8, ry: 12.8, fill: '#FFFFFF' }),
      pupilRG,
      svgEl('path', {
        d: isFemale ? 'M 11 2 Q 22 -9.5 34 3 L 36.5 0.8' : 'M 11 3 Q 22 -8.5 33.5 3',
        stroke: '#2A150E',
        'stroke-width': 3.3,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
    ]);

    const mouthHappyG = svgEl('g', { display: 'none' }, [
      svgEl('path', {
        d: 'M -8.5 22 Q 0 33.5 8.5 22 Z',
        fill: '#F43F5E',
        stroke: '#7F1D1D',
        'stroke-width': 1.5,
      }),
      svgEl('ellipse', { cx: 0, cy: 26.5, rx: 4.5, ry: 2.4, fill: '#FDA4AF' }),
    ]);
    const mouthCalmPath = svgEl('path', {
      d: 'M -6.5 23 Q 0 28.8 6.5 23',
      stroke: '#6D3724',
      'stroke-width': 2.3,
      'stroke-linecap': 'round',
      fill: 'none',
    });

    const faceShiftG = svgEl('g', { transform: 'translate(0, 0)' }, [
      svgEl('ellipse', { cx: -31, cy: 19, rx: 13.5, ry: 8.8, fill: 'url(#wbCheekGrad)' }),
      svgEl('ellipse', { cx: 31, cy: 19, rx: 13.5, ry: 8.8, fill: 'url(#wbCheekGrad)' }),
      svgEl('circle', { cx: -34, cy: 17.5, r: 1.8, fill: '#FFFFFF', opacity: 0.45 }),
      svgEl('circle', { cx: 34, cy: 17.5, r: 1.8, fill: '#FFFFFF', opacity: 0.45 }),
      browL,
      browR,
      squintEyesG,
      openEyesG,
      svgEl('ellipse', { cx: 0, cy: 14.5, rx: 2.9, ry: 2, fill: '#EAA08C' }),
      svgEl('circle', { cx: -0.8, cy: 13.9, r: 0.9, fill: '#FFF5EE', opacity: 0.75 }),
      mouthHappyG,
      mouthCalmPath,
      outfit.hasSunglasses
        ? svgEl('g', { transform: 'translate(0, 7)' }, [
            svgEl('circle', {
              cx: -22,
              cy: 0,
              r: 14.2,
              fill: '#1E1B18',
              'fill-opacity': 0.42,
              stroke: isFemale ? '#FDA4AF' : '#D97706',
              'stroke-width': 2.8,
            }),
            svgEl('path', {
              d: 'M -29 -6 L -19 4',
              stroke: '#FFFFFF',
              'stroke-opacity': 0.45,
              'stroke-width': 2.4,
              'stroke-linecap': 'round',
            }),
            svgEl('circle', {
              cx: 22,
              cy: 0,
              r: 14.2,
              fill: '#1E1B18',
              'fill-opacity': 0.42,
              stroke: isFemale ? '#FDA4AF' : '#D97706',
              'stroke-width': 2.8,
            }),
            svgEl('path', {
              d: 'M 15 -6 L 25 4',
              stroke: '#FFFFFF',
              'stroke-opacity': 0.45,
              'stroke-width': 2.4,
              'stroke-linecap': 'round',
            }),
            svgEl('path', {
              d: 'M -7.8 0 Q 0 -3.2 7.8 0',
              stroke: isFemale ? '#FDA4AF' : '#D97706',
              'stroke-width': 2.6,
              fill: 'none',
            }),
          ])
        : null,
    ]);

    // Signature Bangs & Cowlick ALWAYS visible!
    const cowlickPath = !isFemale
      ? svgEl('path', {
          d: 'M 2 -54 Q 12 -72 22 -59 Q 14 -50 6 -52 Z',
          fill: '#7C4A2D',
        })
      : null;

    const bangsG = svgEl('g', null, [
      svgEl('path', {
        d: 'M -52 -12 C -42 -42, 42 -42, 52 -12 C 36 -22, 22 -6, 12 -18 C 2 -4, -10 -4, -20 -18 C -30 -6, -42 -20, -52 -12 Z',
        fill: 'url(#wbHairGrad)',
      }),
      svgEl('path', {
        d: 'M -33 -30 Q 0 -38.5 33 -30',
        stroke: '#D4956E',
        'stroke-width': 3.4,
        'stroke-linecap': 'round',
        opacity: 0.48,
        fill: 'none',
      }),
      cowlickPath,
    ]);

    const headphonesG = svgEl('g', { display: 'none' }, [
      svgEl('path', {
        d: 'M -58 4 C -58 -58, 58 -58, 58 4',
        stroke: isFemale ? '#F9A8D4' : '#7DD3FC',
        'stroke-width': 6,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
      svgEl('rect', {
        x: -66,
        y: -8,
        width: 14,
        height: 26,
        rx: 7,
        fill: isFemale ? '#F472B6' : '#38BDF8',
        stroke: '#FFFFFF',
        'stroke-width': 2,
      }),
      svgEl('rect', {
        x: 52,
        y: -8,
        width: 14,
        height: 26,
        rx: 7,
        fill: isFemale ? '#F472B6' : '#38BDF8',
        stroke: '#FFFFFF',
        'stroke-width': 2,
      }),
    ]);

    const headG = svgEl('g', { transform: 'translate(160, 122) rotate(0)' }, [
      outfit.isRaincoat
        ? svgEl('g', null, [
            svgEl('ellipse', { cx: 0, cy: -4, rx: 64, ry: 58, fill: '#CA8A04' }),
            svgEl('ellipse', { cx: 0, cy: -5, rx: 61, ry: 55, fill: 'url(#wbTopGrad)' }),
          ])
        : null,
      svgEl('circle', { cx: -56, cy: 8, r: 11.5, fill: 'url(#wbSkinGrad)' }),
      svgEl('circle', { cx: -55, cy: 8, r: 5.5, fill: '#F5A996', opacity: 0.48 }),
      svgEl('circle', { cx: 56, cy: 8, r: 11.5, fill: 'url(#wbSkinGrad)' }),
      svgEl('circle', { cx: 55, cy: 8, r: 5.5, fill: '#F5A996', opacity: 0.48 }),
      // Canonical Plump Squircle Head (Crown 63, Chin 172)
      svgEl('path', {
        d: 'M 0 -52 C 38 -52, 56 -28, 56 4 C 58 34, 40 50, 0 50 C -40 50, -58 34, -56 4 C -56 -28, -38 -52, 0 -52 Z',
        fill: 'url(#wbSkinGrad)',
      }),
      // Canonical Crown Hair Volume ( ALWAYS rendered at exact y = -59 -> global y = 63! )
      svgEl('path', {
        d: 'M -57 -2 C -60 -38, -34 -59, 0 -59 C 34 -59, 60 -38, 57 -2 C 48 -24, -48 -24, -57 -2 Z',
        fill: 'url(#wbHairGrad)',
      }),
      // Signature Side Locks
      isFemale
        ? svgEl('g', null, [
            svgEl('path', {
              d: 'M -54 0 Q -59 24 -46 39',
              stroke: 'url(#wbHairGrad)',
              'stroke-width': 8.5,
              'stroke-linecap': 'round',
              fill: 'none',
            }),
            svgEl('path', {
              d: 'M 54 0 Q 59 24 46 39',
              stroke: 'url(#wbHairGrad)',
              'stroke-width': 8.5,
              'stroke-linecap': 'round',
              fill: 'none',
            }),
          ])
        : null,
      faceShiftG,
      bangsG,
      outfit.isRaincoat
        ? svgEl('path', {
            d: 'M -58 -16 C -48 -58, 48 -58, 58 -16 C 44 -46, -44 -46, -58 -16 Z',
            fill: '#FDE047',
            stroke: '#EAB308',
            'stroke-width': 1.2,
          })
        : null,
      outfit.hasSunVisor
        ? svgEl('g', null, [
            svgEl('path', {
              d: 'M -54 -23 Q 0 -42 54 -23 Q 0 -14 -54 -23 Z',
              fill: '#FDE68A',
              stroke: '#D97706',
              'stroke-width': 1.7,
            }),
            svgEl('path', {
              d: 'M -40 -25 Q 0 -33 40 -25',
              stroke: '#FB7185',
              'stroke-width': 2.5,
              'stroke-linecap': 'round',
              fill: 'none',
            }),
          ])
        : null,
      outfit.hasEarmuffs
        ? svgEl('g', null, [
            svgEl('path', {
              d: 'M -56 2 C -56 -56, 56 -56, 56 2',
              stroke: '#F8FAFC',
              'stroke-width': 5,
              fill: 'none',
            }),
            svgEl('ellipse', { cx: -58, cy: 6, rx: 11, ry: 14, fill: '#FFFBEB', stroke: '#E2E8F0', 'stroke-width': 1.4 }),
            svgEl('ellipse', { cx: 58, cy: 6, rx: 11, ry: 14, fill: '#FFFBEB', stroke: '#E2E8F0', 'stroke-width': 1.4 }),
          ])
        : null,
      headphonesG,
    ]);

    const bodyRootG = svgEl('g', { transform: 'translate(0, 0)' }, [
      umbrellaG,
      twinBunsRootG,
      standLegsG,
      sitLegsG,
      torsoG,
      propG,
      leftArmG,
      rightArmG,
      headG,
    ]);

    // Walking Pet Companion (Kitten for petting_cat, Corgi Puppy for petting_puppy)
    let petRootG = null;
    let petTailG = null;
    let petPawA = null;
    let petPawB = null;
    if (npcAction === 'petting_cat' || npcAction === 'petting_puppy') {
      const isCat = npcAction === 'petting_cat';
      const furMain = isCat ? '#FDBA74' : '#F59E0B';
      const furBelly = '#FFFBEB';
      petTailG = svgEl('path', {
        d: isCat ? 'M 14 -6 Q 24 -18 20 -26' : 'M -15 -7 Q -22 -15 -18 -20',
        stroke: furMain,
        'stroke-width': 5,
        'stroke-linecap': 'round',
        fill: 'none',
      });
      petPawA = svgEl('ellipse', { cx: -8, cy: 8, rx: 4.2, ry: 3.2, fill: furBelly });
      petPawB = svgEl('ellipse', { cx: 8, cy: 8, rx: 4.2, ry: 3.2, fill: furBelly });
      petRootG = svgEl('g', { display: 'none', transform: `translate(${isCat ? 214 : 106}, 272)` }, [
        svgEl('ellipse', { cx: 0, cy: 10, rx: 18, ry: 4.5, fill: '#0F172A', opacity: 0.16 }),
        petTailG,
        svgEl('ellipse', { cx: 0, cy: -1, rx: 15, ry: 10.5, fill: furMain }),
        svgEl('ellipse', { cx: isCat ? -4 : 4, cy: 1, rx: 9, ry: 6.5, fill: furBelly }),
        petPawA,
        petPawB,
        svgEl('g', { transform: `translate(${isCat ? -10 : 10}, -11)` }, [
          svgEl('path', {
            d: isCat ? 'M -9 -6 L -11 -16 L -2 -10 Z' : 'M -9 -6 L -12 -17 L -2 -10 Z',
            fill: furMain,
          }),
          svgEl('path', {
            d: isCat ? 'M 9 -6 L 11 -16 L 2 -10 Z' : 'M 9 -6 L 12 -17 L 2 -10 Z',
            fill: furMain,
          }),
          svgEl('ellipse', { cx: 0, cy: 0, rx: 11.5, ry: 9.8, fill: furMain }),
          svgEl('circle', { cx: -4.2, cy: -1, r: 2, fill: '#1E293B' }),
          svgEl('circle', { cx: 4.2, cy: -1, r: 2, fill: '#1E293B' }),
          svgEl('ellipse', { cx: 0, cy: 2.5, rx: 2, ry: 1.3, fill: '#FB7185' }),
        ]),
      ]);
    }

    const svg = svgEl(
      'svg',
      {
        id: 'articulated-chibi-svg',
        class: 'articulated-chibi-svg',
        viewBox: '0 0 320 304',
        'aria-hidden': 'true',
      },
      [defs, groundShadow, skyCharmG, bodyRootG, petRootG]
    );

    return {
      svg,
      key: `${gender}|${sceneId}|${npcAction}`,
      isFemale,
      outfit,
      npcAction,
      groundShadow,
      skyCharmG,
      bodyRootG,
      umbrellaG,
      twinBunsRootG,
      bunLeftG,
      bunRightG,
      standLegsG,
      sitLegsG,
      sitShoeL,
      sitShoeR,
      leftArmG,
      rightArmG,
      scarfTailG,
      propG,
      headG,
      faceShiftG,
      browL,
      browR,
      squintEyesG,
      squintL,
      squintR,
      openEyesG,
      pupilLG,
      pupilRG,
      mouthHappyG,
      mouthCalmPath,
      bangsG,
      headphonesG,
      petRootG,
      petTailG,
      petPawA,
      petPawB,
    };
  }

  const rigKinematics = {
    mountedKey: '',
    dom: null,
    rafId: 0,
    startTimeMs: Date.now(),
    lastFrameMs: Date.now(),
    standBlend: 0,
    gazeX: 0,
    gazeY: 0,
    targetGazeX: 0,
    targetGazeY: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    pointerActiveUntilMs: 0,
    nextSaccadeAtMs: 0,
    saccadeX: 0,
    saccadeY: 0,
    headTiltDeg: 0,
    secondaryLagDeg: 0,
    nextBlinkAtMs: Date.now() + 2200,
    blinkStartMs: 0,
    blinkDurationMs: 135,
    pendingDoubleBlink: false,
    waveUntilMs: 0,
    happySquintUntilMs: 0,
    hopStartMs: 0,
    petEnteredAtMs: Date.now(),
    lastPetAction: null,
  };

  function isReducedMotionPreferred() {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function ensureCanonicalChibiMounted() {
    if (!state.decision) return;
    const rigPivot = document.getElementById('character-rig-pivot');
    if (!rigPivot) return;

    const gender = state.config.gender === 'female' ? 'female' : 'male';
    const sceneId = state.decision.sceneId || 'pleasant_sunny';
    const npcAction = state.npcAction || 'reading_book';
    const nextKey = `${gender}|${sceneId}|${npcAction}`;

    rigPivot.setAttribute('data-articulated', 'true');
    const spriteImg = document.getElementById('character-sprite-img');
    if (spriteImg) {
      spriteImg.classList.add('is-rig-active');
    }

    if (rigKinematics.mountedKey !== nextKey || !rigKinematics.dom) {
      const existingSvg = document.getElementById('articulated-chibi-svg');
      if (existingSvg && existingSvg.parentNode) {
        existingSvg.parentNode.removeChild(existingSvg);
      }
      if (rigKinematics.lastPetAction !== npcAction) {
        rigKinematics.lastPetAction = npcAction;
        rigKinematics.petEnteredAtMs = Date.now();
      }
      rigKinematics.dom = buildCanonicalChibiRigDom(gender, sceneId, npcAction);
      rigKinematics.mountedKey = nextKey;
      rigPivot.appendChild(rigKinematics.dom.svg);
    }

    if (isReducedMotionPreferred()) {
      rigKinematics.standBlend = state.isStanding ? 1 : 0;
      paintCanonicalChibiFrame(Date.now(), 0.016, true);
    } else if (!rigKinematics.rafId) {
      rigKinematics.lastFrameMs = Date.now();
      const loop = () => {
        const now = Date.now();
        const dt = Math.min(0.05, Math.max(0.004, (now - rigKinematics.lastFrameMs) / 1000));
        rigKinematics.lastFrameMs = now;
        paintCanonicalChibiFrame(now, dt, false);
        rigKinematics.rafId = requestAnimationFrame(loop);
      };
      rigKinematics.rafId = requestAnimationFrame(loop);
    }
  }

  function paintCanonicalChibiFrame(nowMs, dtSec, reduced) {
    const d = rigKinematics.dom;
    if (!d) return;

    const targetStand = state.isStanding ? 1 : 0;
    if (reduced) {
      rigKinematics.standBlend = targetStand;
    } else {
      rigKinematics.standBlend +=
        (targetStand - rigKinematics.standBlend) * Math.min(1, dtSec * 8.5);
    }

    const sb = rigKinematics.standBlend;
    const isSeatedNpc = sb < 0.5;
    const tSec = reduced ? 0 : (nowMs - rigKinematics.startTimeMs) / 1000;
    const breathPhase = tSec * 2.1;
    const propClock = tSec * 1.9;

    // Gaze & Saccades
    let goalX = 0;
    let goalY = 0;
    if (!reduced && nowMs < rigKinematics.pointerActiveUntilMs) {
      goalX = rigKinematics.targetGazeX;
      goalY = rigKinematics.targetGazeY;
    } else if (!reduced) {
      if (nowMs >= rigKinematics.nextSaccadeAtMs) {
        rigKinematics.nextSaccadeAtMs = nowMs + 1400 + Math.random() * 1900;
        if (isSeatedNpc && d.npcAction === 'reading_book') {
          rigKinematics.saccadeX = Math.sin(tSec * 1.6) * 0.55;
          rigKinematics.saccadeY = 0.42;
        } else if (isSeatedNpc && d.npcAction === 'petting_cat') {
          rigKinematics.saccadeX = 0.58;
          rigKinematics.saccadeY = 0.48;
        } else if (isSeatedNpc && d.npcAction === 'petting_puppy') {
          rigKinematics.saccadeX = -0.58;
          rigKinematics.saccadeY = 0.48;
        } else if (isSeatedNpc && d.npcAction === 'scrolling_phone') {
          rigKinematics.saccadeX = (Math.random() - 0.5) * 0.25;
          rigKinematics.saccadeY = Math.random() < 0.25 ? -0.1 : 0.45;
        } else {
          rigKinematics.saccadeX = (Math.random() - 0.5) * 0.65;
          rigKinematics.saccadeY = (Math.random() - 0.5) * 0.38;
        }
      }
      goalX = rigKinematics.saccadeX;
      goalY = rigKinematics.saccadeY;
    }

    const springStep = reduced ? 1 : Math.min(1, dtSec * 10);
    rigKinematics.gazeX += (goalX - rigKinematics.gazeX) * springStep;
    rigKinematics.gazeY += (goalY - rigKinematics.gazeY) * springStep;

    // 3D Stage Tilt
    const wantTiltX = !reduced && nowMs < rigKinematics.pointerActiveUntilMs ? rigKinematics.targetTiltX : 0;
    const wantTiltY = !reduced && nowMs < rigKinematics.pointerActiveUntilMs ? rigKinematics.targetTiltY : 0;
    rigKinematics.tiltX += (wantTiltX - rigKinematics.tiltX) * springStep;
    rigKinematics.tiltY += (wantTiltY - rigKinematics.tiltY) * springStep;
    const rigPivot = document.getElementById('character-rig-pivot');
    if (rigPivot) {
      rigPivot.style.setProperty('--tilt-x', `${rigKinematics.tiltX.toFixed(2)}deg`);
      rigPivot.style.setProperty('--tilt-y', `${rigKinematics.tiltY.toFixed(2)}deg`);
    }

    // Autonomous Blinking
    let blinkAmount = 0;
    if (!reduced) {
      if (rigKinematics.blinkStartMs === 0 && nowMs >= rigKinematics.nextBlinkAtMs) {
        rigKinematics.blinkStartMs = nowMs;
        rigKinematics.blinkDurationMs = 130;
        rigKinematics.pendingDoubleBlink = Math.random() < 0.22;
      }
      if (rigKinematics.blinkStartMs > 0) {
        const bElapsed = nowMs - rigKinematics.blinkStartMs;
        if (bElapsed <= rigKinematics.blinkDurationMs) {
          blinkAmount = Math.sin((bElapsed / rigKinematics.blinkDurationMs) * Math.PI);
        } else if (rigKinematics.pendingDoubleBlink) {
          rigKinematics.pendingDoubleBlink = false;
          rigKinematics.blinkStartMs = nowMs + 75;
        } else {
          rigKinematics.blinkStartMs = 0;
          rigKinematics.nextBlinkAtMs = nowMs + 2400 + Math.random() * 2800;
        }
      }
    }

    const happySquint = !reduced && nowMs < rigKinematics.happySquintUntilMs;
    const waving = !reduced && nowMs < rigKinematics.waveUntilMs;

    // Hop bounce when clicked
    let hopY = 0;
    if (!reduced && rigKinematics.hopStartMs > 0) {
      const hElapsed = (nowMs - rigKinematics.hopStartMs) / 420;
      if (hElapsed < 1) {
        hopY = -Math.sin(hElapsed * Math.PI) * 11 * (1 - hElapsed * 0.35);
      } else {
        rigKinematics.hopStartMs = 0;
      }
    }

    const bodySitDropY = (1 - sb) * 18;
    const breathScaleY = reduced ? 1 : 1 + Math.sin(breathPhase) * 0.016;
    const breathScaleX = reduced ? 1 : 1 - Math.sin(breathPhase) * 0.009;
    const swayDeg = reduced
      ? 0
      : Math.sin(tSec * (d.npcAction === 'listening_music' && isSeatedNpc ? 3.2 : 1.5)) *
        (isSeatedNpc && d.npcAction === 'listening_music' ? 2.2 : 1.1);
    const bodyY = bodySitDropY + hopY - (reduced ? 0 : Math.sin(breathPhase) * 1.6);

    const targetHeadTilt =
      rigKinematics.gazeX * 4.5 +
      (reduced ? 0 : Math.sin(tSec * 1.4) * (isSeatedNpc && d.npcAction === 'listening_music' ? 3.2 : 1.3));
    rigKinematics.headTiltDeg += (targetHeadTilt - rigKinematics.headTiltDeg) * springStep;
    rigKinematics.secondaryLagDeg +=
      (rigKinematics.headTiltDeg - rigKinematics.secondaryLagDeg) * Math.min(1, dtSec * 5.2);

    // Arm kinematics
    let leftArmDeg = 18;
    let rightArmDeg = -18;
    if (waving) {
      leftArmDeg = 20;
      rightArmDeg = -122 + Math.sin(tSec * 13.5) * 16;
    } else if (isSeatedNpc) {
      if (d.npcAction === 'reading_book') {
        leftArmDeg = -34;
        rightArmDeg = 32 + Math.sin(propClock * 1.3) * 6;
      } else if (d.npcAction === 'scrolling_phone') {
        leftArmDeg = -32;
        rightArmDeg = 28 + Math.sin(propClock * 2.4) * 7;
      } else if (d.npcAction === 'petting_cat') {
        leftArmDeg = 14;
        rightArmDeg = -46 + Math.sin(propClock * 3.1) * 11;
      } else if (d.npcAction === 'petting_puppy') {
        leftArmDeg = 46 - Math.sin(propClock * 3.1) * 11;
        rightArmDeg = -14;
      } else {
        leftArmDeg = 22 + Math.sin(propClock * 1.8) * 5;
        rightArmDeg = -22 - Math.sin(propClock * 1.8) * 5;
      }
    } else if (d.outfit.hasUmbrella) {
      leftArmDeg = 16;
      rightArmDeg = -52 + Math.sin(breathPhase) * 2.5;
    } else {
      leftArmDeg = 16 + Math.sin(breathPhase) * 2.5;
      rightArmDeg = -16 - Math.sin(breathPhase) * 2.5;
    }

    // Apply transforms to cached SVG nodes
    d.bodyRootG.setAttribute(
      'transform',
      `translate(160, 280) translate(0, ${bodyY.toFixed(2)}) rotate(${swayDeg.toFixed(
        2
      )}) scale(${breathScaleX.toFixed(4)}, ${breathScaleY.toFixed(4)}) translate(-160, -280)`
    );
    d.groundShadow.setAttribute('rx', String((isSeatedNpc ? 52 : 46 + hopY * 0.3).toFixed(1)));

    d.standLegsG.setAttribute('display', isSeatedNpc ? 'none' : 'inline');
    d.sitLegsG.setAttribute('display', isSeatedNpc ? 'inline' : 'none');
    d.propG.setAttribute('display', isSeatedNpc ? 'inline' : 'none');
    d.headphonesG.setAttribute(
      'display',
      isSeatedNpc && d.npcAction === 'listening_music' ? 'inline' : 'none'
    );

    if (d.umbrellaG) {
      d.umbrellaG.setAttribute(
        'transform',
        `translate(168, ${isSeatedNpc ? 96 : 84}) rotate(${(
          8 +
          rigKinematics.secondaryLagDeg * 0.5
        ).toFixed(2)})`
      );
    }

    if (d.twinBunsRootG) {
      d.twinBunsRootG.setAttribute(
        'transform',
        `translate(160, 118) rotate(${rigKinematics.headTiltDeg.toFixed(2)})`
      );
      const bunLag = (rigKinematics.secondaryLagDeg * 1.3).toFixed(2);
      d.bunLeftG.setAttribute('transform', `translate(-45, -38) rotate(${bunLag})`);
      d.bunRightG.setAttribute('transform', `translate(45, -38) rotate(${bunLag})`);
    }

    d.leftArmG.setAttribute('transform', `translate(128, 184) rotate(${leftArmDeg.toFixed(2)})`);
    d.rightArmG.setAttribute('transform', `translate(192, 184) rotate(${rightArmDeg.toFixed(2)})`);

    if (d.scarfTailG) {
      d.scarfTailG.setAttribute(
        'transform',
        `translate(16, 4) rotate(${(-14 + rigKinematics.secondaryLagDeg * 1.6).toFixed(2)})`
      );
    }

    d.headG.setAttribute(
      'transform',
      `translate(160, 122) rotate(${rigKinematics.headTiltDeg.toFixed(2)})`
    );

    const faceX = (rigKinematics.gazeX * 3.6).toFixed(2);
    const faceY = (rigKinematics.gazeY * 2.3).toFixed(2);
    const pupX = (rigKinematics.gazeX * 3.3).toFixed(2);
    const pupY = (rigKinematics.gazeY * 2.4).toFixed(2);

    d.faceShiftG.setAttribute('transform', `translate(${faceX}, ${faceY})`);
    d.pupilLG.setAttribute('transform', `translate(${pupX}, ${pupY})`);
    d.pupilRG.setAttribute('transform', `translate(${pupX}, ${pupY})`);

    const showSquintOrClosed = happySquint || blinkAmount > 0.72;
    d.squintEyesG.setAttribute('display', showSquintOrClosed ? 'inline' : 'none');
    d.openEyesG.setAttribute('display', showSquintOrClosed ? 'none' : 'inline');

    if (showSquintOrClosed) {
      d.squintL.setAttribute(
        'd',
        happySquint ? 'M -32 6 Q -22 -5.5 -12 6' : 'M -32 6 Q -22 10.5 -12 6'
      );
      d.squintR.setAttribute(
        'd',
        happySquint ? 'M 12 6 Q 22 -5.5 32 6' : 'M 12 6 Q 22 10.5 32 6'
      );
    } else {
      const sy = Math.max(0.15, 1 - blinkAmount * 0.85).toFixed(3);
      const ty = (blinkAmount * 2).toFixed(2);
      d.openEyesG.setAttribute('transform', `translate(0, ${ty}) scale(1, ${sy})`);
    }

    d.mouthHappyG.setAttribute('display', happySquint ? 'inline' : 'none');
    d.mouthCalmPath.setAttribute('display', happySquint ? 'none' : 'inline');
    d.bangsG.setAttribute(
      'transform',
      `rotate(${(rigKinematics.secondaryLagDeg * 0.6).toFixed(2)})`
    );

    // Walking Pet Companion (Kitten walks 292 -> 214; Puppy trots 28 -> 106)
    if (d.petRootG) {
      if (isSeatedNpc) {
        d.petRootG.setAttribute('display', 'inline');
        const isCat = d.npcAction === 'petting_cat';
        const walkProgress = reduced
          ? 1
          : Math.min(1, (nowMs - rigKinematics.petEnteredAtMs) / 1450);
        const easedWalk = 1 - Math.pow(1 - walkProgress, 3);
        const startX = isCat ? 292 : 28;
        const endX = isCat ? 214 : 106;
        const curX = startX + (endX - startX) * easedWalk;
        const bobY = walkProgress < 1 ? Math.abs(Math.sin(tSec * 14)) * -3.5 : 0;
        d.petRootG.setAttribute(
          'transform',
          `translate(${curX.toFixed(1)}, ${(272 + bobY).toFixed(1)})`
        );
        if (d.petTailG) {
          const wag = Math.sin(tSec * 6.5) * 10;
          d.petTailG.setAttribute('transform', `rotate(${wag.toFixed(1)})`);
        }
      } else {
        d.petRootG.setAttribute('display', 'none');
      }
    }
  }

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
        triggerStandUpPose(NPC_OUTFIT_SHOWCASE_MS, false);
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
      if (state.isStanding) {
        npcModePill.textContent = `🧍 Trang phục thời tiết (${state.standRemainingSec}s)`;
      } else {
        npcModePill.textContent = `${actionMeta.accentIcon} NPC · ${actionMeta.labelVi}`;
      }
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

    ensureCanonicalChibiMounted();

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
      tapHint.textContent = state.isStanding
        ? `Đang đứng xem thời tiết · Tự nghỉ sau ${state.standRemainingSec}s`
        : 'Chạm vào Chibi để đứng dậy xem trang phục thời tiết (8.5s)';
    }

    // Render 5-NPC Action Strip
    const actionStrip = document.getElementById('npc-action-strip');
    if (actionStrip) {
      clearChildren(actionStrip);
      ALL_NPC_ACTIONS.forEach((actId) => {
        const meta = NPC_ACTION_META[actId];
        const isCurrent = !state.isStanding && state.npcAction === actId;
        const chip = el(
          'button',
          `npc-action-chip${isCurrent ? ' active' : ''}`,
          `${meta.accentIcon} ${meta.labelVi}`
        );
        chip.type = 'button';
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          clearStandTimers();
          state.isStanding = false;
          state.npcAction = actId;
          renderNpcStage();
        });
        actionStrip.appendChild(chip);
      });
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

  function triggerStandUpPose(customDurationMs, userInteracted) {
    const durationMs =
      typeof customDurationMs === 'number' && customDurationMs > 0
        ? customDurationMs
        : NPC_STAND_DURATION_MS;
    clearStandTimers();
    state.isStanding = true;
    state.standRemainingSec = Math.ceil(durationMs / 1000);

    const now = Date.now();
    rigKinematics.waveUntilMs = now + (userInteracted ? 2200 : 1600);
    if (userInteracted) {
      rigKinematics.happySquintUntilMs = now + 1850;
      rigKinematics.hopStartMs = now;
    }

    renderNpcStage();

    const startedAt = Date.now();
    state.standTickId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remainMs = Math.max(0, durationMs - elapsed);
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
    }, durationMs);
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

  function recomputeDecisionAndRender(showcaseOutfit) {
    if (!state.weather) return;
    const prevKey = state.decision
      ? `${state.decision.sceneId}|${state.decision.gender}|${state.weather.locationName}`
      : null;
    state.decision = evaluateCharacterDecision(state.weather, {
      gender: state.config.gender,
      sensitivity: state.config.sensitivity,
    });
    const nextKey = `${state.decision.sceneId}|${state.decision.gender}|${state.weather.locationName}`;
    if (showcaseOutfit || (prevKey !== null && prevKey !== nextKey)) {
      triggerStandUpPose(NPC_OUTFIT_SHOWCASE_MS, false);
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
    // Stage click, keyboard Enter/Space, and cursor-gaze + 3D tilt tracking
    const stageViewport = document.getElementById('character-stage-viewport');
    if (stageViewport) {
      stageViewport.addEventListener('click', () => {
        triggerStandUpPose(NPC_STAND_DURATION_MS, true);
      });
      stageViewport.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerStandUpPose(NPC_STAND_DURATION_MS, true);
        }
      });
      stageViewport.addEventListener('pointerleave', () => {
        rigKinematics.pointerActiveUntilMs = 0;
        rigKinematics.targetTiltX = 0;
        rigKinematics.targetTiltY = 0;
      });
    }

    window.addEventListener(
      'pointermove',
      (e) => {
        const vp = document.getElementById('character-stage-viewport');
        if (!vp) return;
        const rect = vp.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.44;
        const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / Math.max(120, rect.width * 0.75)));
        const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / Math.max(120, rect.height * 0.75)));
        rigKinematics.targetGazeX = nx;
        rigKinematics.targetGazeY = ny;
        const insideStage =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        rigKinematics.targetTiltX = insideStage ? nx * 7.5 : nx * 2.5;
        rigKinematics.targetTiltY = insideStage ? -ny * 6.5 : -ny * 2;
        rigKinematics.pointerActiveUntilMs = Date.now() + 2400;
      },
      { passive: true }
    );

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
