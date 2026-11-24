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
    reading_book: { id: 'reading_book', labelVi: 'Đọc sách', accentIcon: 'book-open' },
    petting_cat: { id: 'petting_cat', labelVi: 'Chơi với mèo', accentIcon: 'paw-print' },
    petting_puppy: { id: 'petting_puppy', labelVi: 'Chơi với cún', accentIcon: 'paw-print' },
    scrolling_phone: { id: 'scrolling_phone', labelVi: 'Xem điện thoại', accentIcon: 'sparkle' },
    listening_music: { id: 'listening_music', labelVi: 'Nghe nhạc', accentIcon: 'music-notes' },
  };

  const DEFAULT_CONFIG = {
    cityId: 'ha_noi',
    locationName: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
    isGps: false,
    locationSource: null,
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

  let hasPersistedConfig = false;

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

    hasPersistedConfig = Boolean(raw && typeof raw === 'object');
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

  function resolveLocalHour(weather) {
    if (!weather) {
      const now = new Date();
      return now.getHours() + now.getMinutes() / 60;
    }

    const iso = typeof weather.updatedAtIso === 'string' ? weather.updatedAtIso.trim() : '';
    const parsedMs = iso ? Date.parse(iso) : NaN;

    // Priority A: Explicit utcOffsetSeconds (e.g. Open-Meteo timezone=auto -> 25200 for UTC+7)
    if (
      typeof weather.utcOffsetSeconds === 'number' &&
      Number.isFinite(weather.utcOffsetSeconds) &&
      Number.isFinite(parsedMs)
    ) {
      const shifted = new Date(parsedMs + weather.utcOffsetSeconds * 1000);
      return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
    }

    // Priority B: Explicit non-Z ISO timezone offset suffix (e.g. 2026-11-24T09:30:00+07:00)
    if (iso) {
      const offsetMatch = iso.match(
        /T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})$/
      );
      if (offsetMatch) {
        return Number(offsetMatch[1]) + Number(offsetMatch[2]) / 60;
      }
    }

    // Priority C: UTC timestamp fallback using exact UTC+7 for Vietnam coordinates or longitude/15
    if (Number.isFinite(parsedMs)) {
      const d = new Date(parsedMs);
      const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60;
      const lat = Number(weather.latitude);
      const lon = Number(weather.longitude);
      let offsetHrs;
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= 8 &&
        lat <= 24 &&
        lon >= 102 &&
        lon <= 110.5
      ) {
        offsetHrs = 7;
      } else if (Number.isFinite(lon)) {
        offsetHrs = Math.round(lon / 15);
      } else {
        offsetHrs = -new Date().getTimezoneOffset() / 60;
      }
      return ((utcHours + offsetHrs) % 24 + 24) % 24;
    }

    const fallbackNow = new Date();
    return fallbackNow.getHours() + fallbackNow.getMinutes() / 60;
  }

  function resolveSkyTheme(weather, sceneId) {
    const isRaining =
      sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella';

    // Nighttime ONLY: return dark themes ('rain_storm' when raining at night, 'night' otherwise)
    if (!weather.isDay || sceneId === 'clear_night') {
      return isRaining ? 'rain_storm' : 'night';
    }

    // Daytime rain: ALWAYS return light silver-blue 'day_rain' (NEVER dark black during daytime!)
    if (isRaining) {
      return 'day_rain';
    }

    const condLower = (weather.conditionText || '').toLowerCase();
    const localHour = resolveLocalHour(weather);

    if (
      /bình minh|sáng sớm|dawn|sunrise/.test(condLower) ||
      (localHour >= 5 && localHour < 7.25)
    ) {
      return 'dawn';
    }

    if (
      /hoàng hôn|chiều tà|sunset|dusk/.test(condLower) ||
      (localHour >= 16.25 && localHour < 18.5)
    ) {
      return 'sunset';
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
    let badgeIcon = 'sun-dim';

    switch (sceneId) {
      case 'storm_raincoat':
        badgeVi = 'Mưa lớn & gió mạnh';
        badgeIcon = 'cloud-lightning';
        headlineVi = 'Mưa lớn gió mạnh';
        outfitAdviceVi = hasAqiMask
          ? 'Mặc áo mưa kín, đeo thêm khẩu trang'
          : 'Mặc áo mưa kín, tránh cầm ô';
        break;
      case 'light_rain_umbrella':
        badgeVi = 'Mưa nhỏ rải rác';
        badgeIcon = 'umbrella';
        headlineVi = 'Mưa nhỏ · Cầm ô';
        outfitAdviceVi = hasAqiMask
          ? 'Mang ô gọn, đeo khẩu trang khi ra đường'
          : 'Mang ô gọn và áo khoác trượt nước';
        break;
      case 'clear_night':
        badgeIcon = 'moon-stars';
        if (effectiveTemp >= 32) {
          badgeVi = 'Đêm oi bức';
          headlineVi = weather.windSpeedKmh <= 18 ? 'Đêm oi · Gió nhẹ' : 'Đêm oi · Có gió';
          outfitAdviceVi = 'Mặc đồ mỏng thoáng mát';
        } else {
          badgeVi = 'Đêm dịu mát';
          headlineVi = 'Đêm thoáng mát';
          outfitAdviceVi =
            effectiveTemp < 25
              ? 'Mặc thoáng nhẹ, mang theo khoác mỏng'
              : 'Mặc đồ gọn nhẹ thoải mái';
        }
        break;
      case 'hot_sunny':
        if (weather.uvIndex >= 6) {
          badgeVi = 'Nắng gắt · Tia cực tím cao';
          badgeIcon = 'sunglasses';
          headlineVi = 'Oi nóng · Tia cực tím cao';
          outfitAdviceVi = 'Mặc đồ thoáng mát, đeo kính chống nắng';
        } else {
          badgeVi = 'Trời oi nóng';
          badgeIcon = 'thermometer-hot';
          headlineVi = 'Trời oi nóng';
          outfitAdviceVi = 'Mặc đồ mỏng thoáng mát, uống đủ nước';
        }
        break;
      case 'pleasant_sunny':
        if (skyTheme === 'day_cloudy') {
          badgeVi = 'Trời dịu mát';
          badgeIcon = 'cloud-sun';
          headlineVi = 'Nhiều mây dịu mát';
        } else {
          badgeVi = 'Nắng đẹp';
          badgeIcon = 'sun-dim';
          headlineVi = 'Trời nắng dịu';
        }
        outfitAdviceVi =
          weather.uvIndex >= 6 && skyTheme !== 'day_cloudy'
            ? 'Mặc đồ thoáng nhẹ, thoa kem chống nắng'
            : 'Mặc trang phục gọn nhẹ thoải mái';
        break;
      case 'chilly_cozy':
        badgeVi = weather.isDay ? 'Trời se lạnh' : 'Đêm se lạnh';
        badgeIcon = weather.isDay ? 'leaf' : 'moon-stars';
        headlineVi = weather.isDay ? 'Trời se lạnh' : 'Đêm se lạnh';
        outfitAdviceVi = 'Khoác áo mỏng khi ra ngoài';
        break;
      case 'freezing_puffer':
        badgeVi = weather.isDay ? 'Trời rét đậm' : 'Đêm rét đậm';
        badgeIcon = 'snowflake';
        headlineVi = weather.isDay ? 'Trời rét đậm' : 'Đêm rét đậm';
        outfitAdviceVi = 'Mặc áo phao dày, giữ ấm cổ';
        break;
      default:
        badgeVi = 'Thời tiết';
        badgeIcon = 'sun-dim';
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
      badgeIcon,
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

  function pm25ToUsAqi(pm25) {
    if (typeof pm25 !== 'number' || !Number.isFinite(pm25) || pm25 < 0) return null;
    const c = Math.floor(pm25 * 10) / 10;
    const bp = [
      [0.0, 9.0, 0, 50],
      [9.1, 35.4, 51, 100],
      [35.5, 55.4, 101, 150],
      [55.5, 125.4, 151, 200],
      [125.5, 225.4, 201, 300],
      [225.5, 325.4, 301, 500],
    ];
    for (let i = 0; i < bp.length; i += 1) {
      const [cLo, cHi, iLo, iHi] = bp[i];
      if (c <= cHi) {
        return Math.max(0, Math.min(500, Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo)));
      }
    }
    return 500;
  }

  function calibrateOpenMeteoAqi(rawUsAqi, rawPm25) {
    const usAqi =
      typeof rawUsAqi === 'number' && Number.isFinite(rawUsAqi)
        ? Math.max(0, Math.round(rawUsAqi))
        : null;
    const pm25Aqi = pm25ToUsAqi(rawPm25);
    if (usAqi !== null && pm25Aqi !== null) {
      if (usAqi - pm25Aqi > 22) {
        return Math.max(0, Math.min(500, Math.round(pm25Aqi * 0.8 + usAqi * 0.2)));
      }
      return Math.max(pm25Aqi, usAqi);
    }
    return usAqi !== null ? usAqi : pm25Aqi;
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
      current: 'us_aqi,pm2_5',
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
        if (aqiJson && aqiJson.current) {
          const cal = calibrateOpenMeteoAqi(aqiJson.current.us_aqi, aqiJson.current.pm2_5);
          if (typeof cal === 'number') {
            aqi = cal;
          }
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
      utcOffsetSeconds:
        typeof data.utc_offset_seconds === 'number' && Number.isFinite(data.utc_offset_seconds)
          ? data.utc_offset_seconds
          : undefined,
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

    const forecastDays = (data.forecast && data.forecast.forecastday) || [];
    const allHours = [];
    for (let d = 0; d < forecastDays.length; d += 1) {
      const dayHours = forecastDays[d] && Array.isArray(forecastDays[d].hour) ? forecastDays[d].hour : [];
      for (let hIdx = 0; hIdx < dayHours.length; hIdx += 1) {
        allHours.push(dayHours[hIdx]);
      }
    }
    const nowEpoch =
      (typeof cur.last_updated_epoch === 'number' && cur.last_updated_epoch) ||
      (data.location && typeof data.location.localtime_epoch === 'number' && data.location.localtime_epoch) ||
      Math.floor(Date.now() / 1000);
    const upcomingHours = allHours.filter((h) => typeof h.time_epoch === 'number' && h.time_epoch > nowEpoch);
    const chosenHours = (upcomingHours.length > 0 ? upcomingHours : allHours).slice(0, 12);
    const currentSlot =
      allHours.find((h) => typeof h.time_epoch === 'number' && Math.abs(h.time_epoch - nowEpoch) <= 1800) ||
      chosenHours[0] ||
      null;

    const hourly = chosenHours.map((h) => ({
      timeIso: typeof h.time === 'string' ? h.time.replace(' ', 'T') : new Date().toISOString(),
      temperatureC: Math.round((h.temp_c ?? temperatureC) * 10) / 10,
      precipProbPct: Math.max(0, Math.min(100, Math.round(h.chance_of_rain ?? 0))),
      precipMm: Math.max(0, Math.round((h.precip_mm ?? 0) * 100) / 100),
      conditionCode: 'PARTLY_CLOUDY',
    }));

    const pm25Val = cur.air_quality && typeof cur.air_quality.pm2_5 === 'number' ? cur.air_quality.pm2_5 : null;
    const aqi = pm25ToUsAqi(pm25Val);

    let utcOffsetSeconds;
    if (
      data.location &&
      typeof data.location.localtime === 'string' &&
      typeof data.location.localtime_epoch === 'number'
    ) {
      const localAsUtcMs = Date.parse(`${data.location.localtime.replace(' ', 'T')}:00Z`);
      if (Number.isFinite(localAsUtcMs)) {
        utcOffsetSeconds = Math.round((localAsUtcMs - data.location.localtime_epoch * 1000) / 1000);
      }
    }

    const snapshot = {
      provider: 'weatherapi',
      locationName,
      latitude: lat,
      longitude: lon,
      updatedAtIso: new Date().toISOString(),
      utcOffsetSeconds,
      temperatureC,
      feelsLikeC,
      humidityPct,
      windSpeedKmh,
      windGustKmh,
      uvIndex,
      precipMmPerHr,
      precipProbPct: Math.max(
        0,
        Math.min(100, Math.round((currentSlot && currentSlot.chance_of_rain) ?? (precipMmPerHr >= 0.2 ? 70 : 10)))
      ),
      conditionText: (cur.condition && cur.condition.text) || (isDay ? 'Thời tiết dịu nhẹ' : 'Đêm mát mẻ'),
      isDay,
      hourly,
    };
    if (typeof aqi === 'number') {
      snapshot.aqi = aqi;
    }
    return snapshot;
  }

  async function fetchTomorrowIoWeather(lat, lon, locationName, apiKey) {
    const params = new URLSearchParams({
      location: `${lat},${lon}`,
      timesteps: '1m,1h',
      units: 'metric',
      apikey: apiKey.trim(),
    });
    const res = await fetch(`https://api.tomorrow.io/v4/weather/forecast?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Tomorrow.io HTTP ${res.status}`);
    const data = await res.json();
    const timelines = data.timelines || {};
    const minutely = Array.isArray(timelines.minutely) ? timelines.minutely : [];
    const hourlyItems = Array.isArray(timelines.hourly) ? timelines.hourly : [];
    const curItem = minutely[0] || hourlyItems[0] || {};
    const vals = curItem.values || {};
    const hr0 = (hourlyItems[0] && hourlyItems[0].values) || {};
    const updatedAtIso = curItem.time || new Date().toISOString();
    const localHr = resolveLocalHour({ updatedAtIso, latitude: lat, longitude: lon });
    const isDay = localHr >= 6 && localHr < 18.25;

    const pick = (k, def) => (typeof vals[k] === 'number' ? vals[k] : typeof hr0[k] === 'number' ? hr0[k] : def);
    const temperatureC = Math.round(pick('temperature', 26) * 10) / 10;
    const feelsLikeC = Math.round(pick('temperatureApparent', temperatureC) * 10) / 10;
    const humidityPct = Math.max(0, Math.min(100, Math.round(pick('humidity', 70))));
    const windSpeedKmh = Math.max(0, Math.round(pick('windSpeed', 0) * 3.6 * 10) / 10);
    const windGustKmh = Math.max(windSpeedKmh, Math.round(pick('windGust', 0) * 3.6 * 10) / 10);
    const uvIndex = Math.max(0, Math.round(pick('uvIndex', 0) * 10) / 10);
    const next15m = minutely
      .slice(0, 15)
      .reduce((m, item) => Math.max(m, (item.values && item.values.precipitationIntensity) || 0), 0);
    const precipMmPerHr = Math.max(0, Math.round(Math.max(pick('precipitationIntensity', 0), next15m) * 100) / 100);
    const precipProbPct = Math.max(0, Math.min(100, Math.round(pick('precipitationProbability', 0))));

    const hourly = hourlyItems.slice(1, 13).map((item) => {
      const hv = item.values || {};
      return {
        timeIso: item.time || new Date().toISOString(),
        temperatureC: Math.round((hv.temperature ?? temperatureC) * 10) / 10,
        precipProbPct: Math.max(0, Math.min(100, Math.round(hv.precipitationProbability ?? 0))),
        precipMm: Math.max(0, Math.round((hv.precipitationIntensity ?? 0) * 100) / 100),
        conditionCode: 'PARTLY_CLOUDY',
      };
    });

    return {
      provider: 'tomorrow_io',
      locationName,
      latitude: lat,
      longitude: lon,
      updatedAtIso,
      temperatureC,
      feelsLikeC,
      humidityPct,
      windSpeedKmh,
      windGustKmh,
      uvIndex,
      precipMmPerHr,
      precipProbPct,
      conditionText: precipMmPerHr >= 0.2 ? 'Có mưa rải rác' : isDay ? 'Thời tiết dịu nhẹ' : 'Đêm mát mẻ',
      isDay,
      hourly,
    };
  }

  async function fetchGoogleWeather(lat, lon, locationName, apiKey) {
    const key = apiKey.trim();
    const baseQs = `key=${encodeURIComponent(key)}&location.latitude=${encodeURIComponent(lat)}&location.longitude=${encodeURIComponent(lon)}&unitsSystem=METRIC&languageCode=vi`;
    const [curRes, hrRes] = await Promise.all([
      fetch(`https://weather.googleapis.com/v1/currentConditions:lookup?${baseQs}`),
      fetch(`https://weather.googleapis.com/v1/forecast/hours:lookup?${baseQs}&hours=12&pageSize=12`),
    ]);
    if (!curRes.ok) throw new Error(`Google Weather HTTP ${curRes.status}`);
    if (!hrRes.ok) throw new Error(`Google Weather hourly HTTP ${hrRes.status}`);
    const cur = await curRes.json();
    const hrData = await hrRes.json();

    const toC = (obj, def) => {
      if (!obj || typeof obj.degrees !== 'number') return def;
      return obj.unit === 'FAHRENHEIT'
        ? Math.round((((obj.degrees - 32) * 5) / 9) * 10) / 10
        : Math.round(obj.degrees * 10) / 10;
    };
    const toKmh = (v) => {
      if (typeof v === 'number') return Math.round(v * 10) / 10;
      if (!v || typeof v.value !== 'number') return 0;
      if (v.unit === 'METERS_PER_SECOND') return Math.round(v.value * 3.6 * 10) / 10;
      if (v.unit === 'MILES_PER_HOUR') return Math.round(v.value * 1.60934 * 10) / 10;
      return Math.round(v.value * 10) / 10;
    };

    const isDay = cur.isDaytime !== false;
    const temperatureC = toC(cur.temperature, 26);
    const feelsLikeC = toC(cur.feelsLikeTemperature, temperatureC);
    const humidityPct = Math.max(0, Math.min(100, Math.round(cur.relativeHumidity ?? 68)));
    const uvIndex = Math.max(0, Math.round((cur.uvIndex ?? 0) * 10) / 10);
    const windSpeedKmh = Math.max(0, toKmh(cur.wind && cur.wind.speed));
    const windGustKmh = Math.max(windSpeedKmh, toKmh(cur.wind && cur.wind.gust));
    const precipProbPct = Math.max(0, Math.min(100, Math.round((cur.precipitation && cur.precipitation.probability && cur.precipitation.probability.percent) ?? 0)));
    const precipMmPerHr = Math.max(0, Math.round(((cur.precipitation && cur.precipitation.qpf && cur.precipitation.qpf.quantity) ?? 0) * 100) / 100);
    const conditionText =
      (cur.weatherCondition && cur.weatherCondition.description && cur.weatherCondition.description.text) ||
      (isDay ? 'Thời tiết ổn định' : 'Đêm dịu mát');

    const rawHours = Array.isArray(hrData.forecastHours) ? hrData.forecastHours : [];
    const hourly = rawHours.slice(0, 12).map((h) => ({
      timeIso: (h.interval && h.interval.startTime) || new Date().toISOString(),
      temperatureC: toC(h.temperature, temperatureC),
      precipProbPct: Math.max(0, Math.min(100, Math.round((h.precipitation && h.precipitation.probability && h.precipitation.probability.percent) ?? 0))),
      precipMm: Math.max(0, Math.round(((h.precipitation && h.precipitation.qpf && h.precipitation.qpf.quantity) ?? 0) * 100) / 100),
      conditionCode: (h.weatherCondition && h.weatherCondition.type) || 'CLEAR',
    }));

    return {
      provider: 'google',
      locationName,
      latitude: lat,
      longitude: lon,
      updatedAtIso: cur.currentTime || new Date().toISOString(),
      temperatureC,
      feelsLikeC,
      humidityPct,
      windSpeedKmh,
      windGustKmh,
      uvIndex,
      precipMmPerHr,
      precipProbPct,
      conditionText,
      isDay,
      hourly,
    };
  }

  async function fetchLocalConsensusWeather(cfg, lat, lon, locationName) {
    const qs = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      locationName,
      provider: cfg.provider || 'auto',
      gender: cfg.gender || 'male',
      sensitivity: cfg.sensitivity || 'normal',
    });
    const headers = { Accept: 'application/json' };
    if (cfg.tomorrowApiKey && cfg.tomorrowApiKey.trim().length > 5) {
      headers['X-Tomorrow-Api-Key'] = cfg.tomorrowApiKey.trim();
    }
    if (cfg.weatherApiKey && cfg.weatherApiKey.trim().length > 5) {
      headers['X-Weatherapi-Key'] = cfg.weatherApiKey.trim();
    }
    if (cfg.googleApiKey && cfg.googleApiKey.trim().length > 5) {
      headers['X-Google-Api-Key'] = cfg.googleApiKey.trim();
    }
    const payload = await fetchJsonWithTimeout(
      `http://localhost:8787/api/weather?${qs.toString()}`,
      { headers },
      2200
    );
    if (payload && payload.snapshot && typeof payload.snapshot.temperatureC === 'number') {
      return payload.snapshot;
    }
    return null;
  }

  async function fetchLiveWeatherWithFallback(cfg) {
    const lat = Number(cfg.latitude) || 21.0285;
    const lon = Number(cfg.longitude) || 105.8542;
    const locationName = cfg.locationName || 'Hà Nội';
    const provider = cfg.provider || 'auto';

    // Prefer local WeatherBuddy backend when running (adds NOAA METAR + MET Norway ECMWF consensus)
    const localSnap = await fetchLocalConsensusWeather(cfg, lat, lon, locationName);
    if (localSnap) {
      return localSnap;
    }

    if (
      (provider === 'tomorrow_io' || provider === 'auto') &&
      cfg.tomorrowApiKey &&
      cfg.tomorrowApiKey.trim().length > 5
    ) {
      try {
        return await fetchTomorrowIoWeather(lat, lon, locationName, cfg.tomorrowApiKey);
      } catch {
        // Fallback to next available provider
      }
    }

    if (
      (provider === 'weatherapi' || provider === 'auto') &&
      cfg.weatherApiKey &&
      cfg.weatherApiKey.trim().length > 5
    ) {
      try {
        return await fetchWeatherApiCom(lat, lon, locationName, cfg.weatherApiKey);
      } catch {
        // Fallback to next available provider
      }
    }

    if (
      (provider === 'google' || provider === 'auto') &&
      cfg.googleApiKey &&
      cfg.googleApiKey.trim().length > 5
    ) {
      try {
        return await fetchGoogleWeather(lat, lon, locationName, cfg.googleApiKey);
      } catch {
        // Fallback to Open-Meteo Free
      }
    }

    return fetchOpenMeteoWeather(lat, lon, locationName);
  }

  const ASCII_VI_CITY_MAP = [
    [/^(?:tp\.?\s*)?ho chi minh(?:\s+city)?$/i, 'TP. Hồ Chí Minh'],
    [/^thanh pho ho chi minh$/i, 'TP. Hồ Chí Minh'],
    [/^(?:tp\.?\s*)?hồ chí minh$/i, 'TP. Hồ Chí Minh'],
    [/^tp\.?\s*hcm$|^hcm$/i, 'TP. Hồ Chí Minh'],
    [/^sai\s*gon$/i, 'TP. Hồ Chí Minh'],
    [/^(?:tp\.?\s*)?ha\s*noi$/i, 'Hà Nội'],
    [/^thanh pho ha noi$/i, 'Hà Nội'],
    [/^(?:tp\.?\s*)?hà nội$/i, 'Hà Nội'],
    [/^(?:tp\.?\s*)?da\s*nang$/i, 'Đà Nẵng'],
    [/^thanh pho da nang$/i, 'Đà Nẵng'],
    [/^(?:tp\.?\s*)?đà nẵng$/i, 'Đà Nẵng'],
    [/^(?:tp\.?\s*)?da\s*lat$/i, 'Đà Lạt'],
    [/^(?:tp\.?\s*)?can\s*tho$/i, 'Cần Thơ'],
    [/^thanh pho can tho$/i, 'Cần Thơ'],
    [/^(?:tp\.?\s*)?cần thơ$/i, 'Cần Thơ'],
    [/^(?:thi xa\s+)?sa\s*pa$/i, 'Sa Pa'],
    [/^(?:tp\.?\s*)?hai\s*phong$/i, 'Hải Phòng'],
    [/^(?:tp\.?\s*)?hải phòng$/i, 'Hải Phòng'],
    [/^(?:tp\.?\s*)?nha\s*trang$/i, 'Nha Trang'],
    [/^binh\s*duong$/i, 'Bình Dương'],
    [/^dong\s*nai$|^bien\s*hoa$/i, 'Đồng Nai'],
    [/^ba ria\s*-?\s*vung tau$|^vung\s*tau$/i, 'Vũng Tàu'],
    [/^(?:tp\.?\s*)?hue$|^thua thien\s*-?\s*hue$/i, 'Huế'],
  ];

  function cleanVietnamesePlaceToken(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
      return '';
    }
    const cleaned = raw
      .trim()
      .replace(/^Thành phố\s+/i, 'TP. ')
      .replace(/^Tỉnh\s+/i, '')
      .replace(/\s+/g, ' ');

    for (const [pattern, viName] of ASCII_VI_CITY_MAP) {
      if (pattern.test(cleaned)) {
        return viName;
      }
    }
    return cleaned;
  }

  function composeVietnameseLocationName(district, city) {
    const d = cleanVietnamesePlaceToken(district);
    const c = cleanVietnamesePlaceToken(city);
    if (
      d &&
      c &&
      d.toLowerCase() !== c.toLowerCase() &&
      !c.toLowerCase().includes(d.toLowerCase()) &&
      !d.toLowerCase().includes(c.toLowerCase())
    ) {
      return `${d}, ${c}`;
    }
    if (c) return c;
    if (d) return d;
    return '';
  }

  function findNearestPresetCity(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    let best = null;
    let bestDistSq = Infinity;
    for (const city of PRESET_CITIES) {
      const dLat = lat - city.latitude;
      const dLon = lon - city.longitude;
      const distSq = dLat * dLat + dLon * dLon;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = city;
      }
    }
    if (best && bestDistSq <= 0.28 * 0.28) {
      return best;
    }
    return null;
  }

  function normalizeVietnameseLocationName(rawLabel, lat, lon) {
    if (typeof rawLabel === 'string' && rawLabel.trim()) {
      const parts = rawLabel
        .split(',')
        .map((p) => cleanVietnamesePlaceToken(p))
        .filter(Boolean);
      if (parts.length >= 2) {
        const composed = composeVietnameseLocationName(parts[0], parts[parts.length - 1]);
        if (composed) return composed;
      }
      if (parts.length === 1 && parts[0]) {
        return parts[0];
      }
    }
    const nearest = findNearestPresetCity(lat, lon);
    if (nearest) return nearest.nameVi;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `Vị trí (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    }
    return 'Vị trí hiện tại';
  }

  async function fetchJsonWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 3800);
    try {
      const res = await fetch(
        url,
        Object.assign({}, options || {}, { signal: controller.signal })
      );
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function reverseGeocodeVi(lat, lon) {
    // 1. Try local WeatherBuddy backend reverse-geocode endpoint if running
    const localRev = await fetchJsonWithTimeout(
      `http://localhost:8787/api/reverse-geocode?lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}`,
      { headers: { Accept: 'application/json' } },
      2500
    );
    if (localRev && localRev.locationName) {
      return normalizeVietnameseLocationName(localRev.locationName, lat, lon);
    }

    // 2. Fallback to BigDataCloud Vietnamese reverse-geocode
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lon)}&localityLanguage=vi`;
    const bdcData = await fetchJsonWithTimeout(
      bdcUrl,
      { headers: { Accept: 'application/json' } },
      3800
    );
    if (bdcData && typeof bdcData === 'object') {
      const district = cleanVietnamesePlaceToken(bdcData.locality || '');
      const city = cleanVietnamesePlaceToken(
        bdcData.city || bdcData.principalSubdivision || ''
      );
      const composed = composeVietnameseLocationName(district, city);
      if (composed) {
        return composed;
      }
    }

    return normalizeVietnameseLocationName('', lat, lon);
  }

  function getBrowserPositionPromise(options) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') {
        reject(new Error('GEOLOCATION_UNSUPPORTED'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  async function autoLocateViaNetworkFallback() {
    // 1. Local backend /api/auto-locate (15-min cached, zero-key)
    const backendLoc = await fetchJsonWithTimeout(
      'http://localhost:8787/api/auto-locate',
      { headers: { Accept: 'application/json' } },
      3500
    );
    if (
      backendLoc &&
      typeof backendLoc.latitude === 'number' &&
      typeof backendLoc.longitude === 'number' &&
      Number.isFinite(backendLoc.latitude) &&
      Number.isFinite(backendLoc.longitude)
    ) {
      const lat = Math.round(backendLoc.latitude * 10000) / 10000;
      const lon = Math.round(backendLoc.longitude * 10000) / 10000;
      const locationName = normalizeVietnameseLocationName(
        backendLoc.locationName || backendLoc.city || '',
        lat,
        lon
      );
      return { latitude: lat, longitude: lon, locationName, source: 'ip' };
    }

    // 2. Direct ipwho.is Vietnamese IP geolocation
    const ipwho = await fetchJsonWithTimeout(
      'https://ipwho.is/?lang=vi',
      { headers: { Accept: 'application/json' } },
      3500
    );
    if (
      ipwho &&
      ipwho.success !== false &&
      typeof ipwho.latitude === 'number' &&
      typeof ipwho.longitude === 'number' &&
      Number.isFinite(ipwho.latitude) &&
      Number.isFinite(ipwho.longitude)
    ) {
      const lat = Math.round(ipwho.latitude * 10000) / 10000;
      const lon = Math.round(ipwho.longitude * 10000) / 10000;
      let rawCity = cleanVietnamesePlaceToken(ipwho.city || ipwho.region || '');
      if (!rawCity || /^[A-Za-z\s.-]+$/.test(rawCity)) {
        const bdcCity = await fetchJsonWithTimeout(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
            lat
          )}&longitude=${encodeURIComponent(lon)}&localityLanguage=vi`,
          { headers: { Accept: 'application/json' } },
          3200
        );
        if (bdcCity) {
          const enriched = cleanVietnamesePlaceToken(
            bdcCity.city || bdcCity.principalSubdivision || ''
          );
          if (enriched) rawCity = enriched;
        }
      }
      const locationName = normalizeVietnameseLocationName(rawCity, lat, lon);
      return { latitude: lat, longitude: lon, locationName, source: 'ip' };
    }

    // 3. Direct BigDataCloud client-IP reverse geocode
    const bdc = await fetchJsonWithTimeout(
      'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=vi',
      { headers: { Accept: 'application/json' } },
      3800
    );
    if (
      bdc &&
      typeof bdc.latitude === 'number' &&
      typeof bdc.longitude === 'number' &&
      Number.isFinite(bdc.latitude) &&
      Number.isFinite(bdc.longitude)
    ) {
      const lat = Math.round(bdc.latitude * 10000) / 10000;
      const lon = Math.round(bdc.longitude * 10000) / 10000;
      const rawCity = cleanVietnamesePlaceToken(
        bdc.city || bdc.principalSubdivision || bdc.locality || ''
      );
      const locationName = normalizeVietnameseLocationName(rawCity, lat, lon);
      return { latitude: lat, longitude: lon, locationName, source: 'ip' };
    }

    return null;
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

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const PHOSPHOR_DUOTONE_SHAPES = {
    crosshair: [
      { tag: 'circle', cx: '128', cy: '128', r: '88', opacity: '0.2' },
      {
        tag: 'path',
        d: 'M232,120h-8.34A96.14,96.14,0,0,0,136,32.34V24a8,8,0,0,0-16,0v8.34A96.14,96.14,0,0,0,32.34,120H24a8,8,0,0,0,0,16h8.34A96.14,96.14,0,0,0,120,223.66V232a8,8,0,0,0,16,0v-8.34A96.14,96.14,0,0,0,223.66,136H232a8,8,0,0,0,0-16Zm-96,87.6V200a8,8,0,0,0-16,0v7.6A80.15,80.15,0,0,1,48.4,136H56a8,8,0,0,0,0-16H48.4A80.15,80.15,0,0,1,120,48.4V56a8,8,0,0,0,16,0V48.4A80.15,80.15,0,0,1,207.6,120H200a8,8,0,0,0,0,16h7.6A80.15,80.15,0,0,1,136,207.6ZM128,88a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z',
      },
    ],
    'arrows-clockwise': [
      { tag: 'circle', cx: '128', cy: '128', r: '88', opacity: '0.18' },
      {
        tag: 'path',
        d: 'M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z',
      },
    ],
    clock: [
      { tag: 'circle', cx: '128', cy: '128', r: '96', opacity: '0.2' },
      {
        tag: 'path',
        d: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z',
      },
    ],
    eye: [
      {
        tag: 'path',
        d: 'M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Zm0,112a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z',
      },
    ],
    'eye-slash': [
      {
        tag: 'path',
        d: 'M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Zm0,112a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z',
        opacity: '0.18',
      },
      {
        tag: 'path',
        d: 'M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.75C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z',
      },
    ],
    'cloud-lightning': [
      {
        tag: 'path',
        d: 'M156,24A68.07,68.07,0,0,0,89.44,78H76a44,44,0,0,0,0,88h80a68,68,0,0,0,0-136Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M156,16A76.2,76.2,0,0,0,83.24,70.06,52.66,52.66,0,0,0,76,69.4a52,52,0,0,0,0,104h38.1l-12.78,21.3a8,8,0,0,0,6.86,12.12H133.7l-12.56,20.93a8,8,0,1,0,13.72,8.24l24-40a8,8,0,0,0-6.86-12.12H126.48l8.76-14.59H156a76,76,0,0,0,0-152Zm0,136H76a36,36,0,0,1,0-72,37.1,37.1,0,0,1,9.91,1.35,8,8,0,0,0,10-6.37A60.06,60.06,0,1,1,156,152Z',
      },
    ],
    umbrella: [
      {
        tag: 'path',
        d: 'M224,136a104,104,0,0,0-208,0Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M128,24A104.11,104.11,0,0,0,24,128a16,16,0,0,0,16,16h80v56a32,32,0,0,0,64,0,8,8,0,0,0-16,0,16,16,0,0,1-32,0V144h80a16,16,0,0,0,16-16A104.11,104.11,0,0,0,128,24ZM40,128a88.1,88.1,0,0,1,176,0Z',
      },
    ],
    'moon-stars': [
      {
        tag: 'path',
        d: 'M216.7,152.6A91.9,91.9,0,0,1,103.4,39.3a92,92,0,1,0,113.3,113.3Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm72.77,97a8,8,0,0,1,1.43,8A96,96,0,1,1,95.07,37.8a8,8,0,0,1,10.6,9.06A88.07,88.07,0,0,0,209.14,150.33,8,8,0,0,1,216.77,153Zm-19.39,14.88c-1.79.09-3.59.14-5.38.14A104.11,104.11,0,0,1,88,64c0-1.79,0-3.59.14-5.38A80,80,0,1,0,197.38,167.86Z',
      },
    ],
    sunglasses: [
      {
        tag: 'path',
        d: 'M104,140v24a36,36,0,0,1-72,0V140Zm120,0H152v24a36,36,0,0,0,72,0Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M200,40a8,8,0,0,0,0,16,16,16,0,0,1,16,16v56H40V72A16,16,0,0,1,56,56a8,8,0,0,0,0-16A32,32,0,0,0,24,72v92a44,44,0,0,0,88,0V144h32v20a44,44,0,0,0,88,0V72A32,32,0,0,0,200,40ZM96,164a28,28,0,0,1-56,0V144H96Zm120,0a28,28,0,0,1-56,0V144h56Z',
      },
    ],
    'thermometer-hot': [
      {
        tag: 'path',
        d: 'M120,147V48a32,32,0,0,0-64,0v99a56,56,0,1,0,64,0Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M128,143V48a40,40,0,0,0-80,0v95a64,64,0,1,0,80,0ZM88,224a48,48,0,0,1-27.42-87.4A8,8,0,0,0,64,130V48a24,24,0,0,1,48,0v82a8,8,0,0,0,3.42,6.6A48,48,0,0,1,88,224Zm24-48a24,24,0,1,1-32-22.63V88a8,8,0,0,1,16,0v65.37A24,24,0,0,1,112,176ZM244.63,75.56c-12,18.49-28.48,15.32-39.17,11.61-7.47-2.59-13.91-4.83-18.09,1.62a8,8,0,0,1-13.42-8.7c12-18.49,28.48-15.32,39.17-11.61,7.47,2.59,13.91,4.83,18.09-1.62a8,8,0,0,1,13.42,8.7Zm0,40c-12,18.49-28.48,15.32-39.17,11.61-7.47-2.59-13.91-4.83-18.09,1.62a8,8,0,0,1-13.42-8.7c12-18.49,28.48-15.32,39.17-11.61,7.47,2.59,13.91,4.83,18.09-1.62a8,8,0,0,1,13.42,8.7Z',
      },
    ],
    'cloud-sun': [
      {
        tag: 'path',
        d: 'M156,72a68.06,68.06,0,0,0-66.57,54H76a44,44,0,0,0,0,88h80a68,68,0,0,0,0-142Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M156,64a76.19,76.19,0,0,0-48.66,17.57A56,56,0,0,0,36.22,126a52,52,0,0,0,39.78,94h80a76,76,0,0,0,0-156ZM96,96a40,40,0,0,1,6.57.55A76.26,76.26,0,0,0,82.1,126H76a51.63,51.63,0,0,0-22.25,5A40,40,0,0,1,96,96Zm60,108H76a36,36,0,0,1,0-72h13.43a8,8,0,0,0,7.87-6.51A60,60,0,1,1,156,204ZM87.66,43.78a8,8,0,0,1,10.74-3.58,8,8,0,0,1,3.58,10.74l-8,16a8,8,0,1,1-14.32-7.16ZM29.78,87.66a8,8,0,0,1,11.31,0l11.32,11.31a8,8,0,0,1-11.32,11.32L29.78,99A8,8,0,0,1,29.78,87.66ZM139.06,54.52a8,8,0,1,1-14.32-7.16l8-16a8,8,0,1,1,14.32,7.16Z',
      },
    ],
    'sun-dim': [
      { tag: 'circle', cx: '128', cy: '128', r: '60', opacity: '0.2' },
      {
        tag: 'path',
        d: 'M120,40V32a8,8,0,0,1,16,0v8a8,8,0,0,1-16,0Zm8,24a64,64,0,1,0,64,64A64.07,64.07,0,0,0,128,64Zm0,112a48,48,0,1,1,48-48A48.05,48.05,0,0,1,128,176ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-8-8A8,8,0,0,0,50.34,61.66Zm0,116.68-8,8a8,8,0,0,0,11.32,11.32l8-8a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l8-8a8,8,0,0,0-11.32-11.32l-8,8A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l8,8a8,8,0,0,0,11.32-11.32ZM40,120H32a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Zm88,88a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-8A8,8,0,0,0,128,208Zm96-88h-8a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Z',
      },
    ],
    leaf: [
      {
        tag: 'path',
        d: 'M216,40C136,40,40,80,64,192,176,216,216,120,216,40Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49c.57,15.92,5.21,32,13.79,47.85l-19.51,19.5a8,8,0,0,0,11.32,11.32l19.5-19.51C81,210.73,97.09,215.37,113,215.94q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.92,116.2,223.45,40.07ZM153.75,189.5c-22.75,13.78-49.68,14-76.71.77l88.63-88.62a8,8,0,0,0-11.32-11.32L65.73,179c-13.19-27-13-54,.77-76.71,22.09-36.47,74.6-56.44,141.31-54.06C210.2,114.89,190.22,167.41,153.75,189.5Z',
      },
    ],
    snowflake: [
      { tag: 'circle', cx: '128', cy: '128', r: '64', opacity: '0.2' },
      {
        tag: 'path',
        d: 'M220,120H187.31l23.52-23.51a8,8,0,0,0-11.32-11.32L164.69,120H136V91.31l34.83-34.82a8,8,0,0,0-11.32-11.32L136,68.69V36a8,8,0,0,0-16,0V68.69L96.49,45.17A8,8,0,0,0,85.17,56.49L120,91.31V120H91.31L56.49,85.17A8,8,0,0,0,45.17,96.49L68.69,120H36a8,8,0,0,0,0,16H68.69L45.17,159.51a8,8,0,0,0,11.32,11.32L91.31,136H120v28.69L85.17,199.51a8,8,0,0,0,11.32,11.32L120,187.31V220a8,8,0,0,0,16,0V187.31l23.51,23.52a8,8,0,0,0,11.32-11.32L136,164.69V136h28.69l34.82,34.83a8,8,0,0,0,11.32-11.32L187.31,136H220a8,8,0,0,0,0-16Z',
      },
    ],
    'shield-warning': [
      {
        tag: 'path',
        d: 'M216,112V56a8,8,0,0,0-8-8H48a8,8,0,0,0-8,8v56c0,96,88,120,88,120S216,208,216,112Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112V56H208ZM120,136V96a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z',
      },
    ],
    drop: [
      {
        tag: 'path',
        d: 'M208,144c0-72-80-128-80-128S48,72,48,144a80,80,0,0,0,160,0Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M174,47.75a254.19,254.19,0,0,0-41.45-38.3,8,8,0,0,0-9.18,0A254.19,254.19,0,0,0,82,47.75C54.51,79.32,40,112.6,40,144a88,88,0,0,0,176,0C216,112.6,201.49,79.32,174,47.75ZM128,216a72.08,72.08,0,0,1-72-72c0-57.23,55.47-105,72-118,16.53,13,72,60.75,72,118A72.08,72.08,0,0,1,128,216Z',
      },
    ],
    sparkle: [
      {
        tag: 'path',
        d: 'M138.84,26.13l19.8,54.45a8,8,0,0,0,4.78,4.78l54.45,19.8a4,4,0,0,1,0,7.52l-54.45,19.8a8,8,0,0,0-4.78,4.78l-19.8,54.45a4,4,0,0,1-7.52,0l-19.8-54.45a8,8,0,0,0-4.78-4.78L52.29,112.68a4,4,0,0,1,0-7.52l54.45-19.8a8,8,0,0,0,4.78-4.78l19.8-54.45A4,4,0,0,1,138.84,26.13Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z',
      },
    ],
    'book-open': [
      {
        tag: 'path',
        d: 'M128,88a32,32,0,0,1,32-32h64a8,8,0,0,1,8,8V192a8,8,0,0,1-8,8H160a32,32,0,0,0-32,32Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M224,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h64a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z',
      },
    ],
    'paw-print': [
      {
        tag: 'path',
        d: 'M184,176a44,44,0,0,1-44,44H116a44,44,0,0,1-44-44c0-24.3,29.55-56,56-56S184,151.7,184,176Z',
        opacity: '0.2',
      },
      {
        tag: 'path',
        d: 'M212,80a28,28,0,1,0,28,28A28,28,0,0,0,212,80Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,212,120ZM44,80a28,28,0,1,0,28,28A28,28,0,0,0,44,80Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,44,120ZM92,88A28,28,0,1,0,64,60,28,28,0,0,0,92,88Zm0-40a12,12,0,1,1-12,12A12,12,0,0,1,92,48Zm72,40a28,28,0,1,0-28-28A28,28,0,0,0,164,88Zm0-40a12,12,0,1,1-12,12A12,12,0,0,1,164,48Zm23.1,100.58a35.3,35.3,0,0,1-16.87-21.14,44,44,0,0,0-84.46,0A35.25,35.25,0,0,1,69,148.82,40,40,0,0,0,88,224a39.48,39.48,0,0,0,15.52-3.13,64.09,64.09,0,0,1,48.87,0,40,40,0,0,0,34.73-72.29ZM168,208a24,24,0,0,1-9.45-1.93,80.14,80.14,0,0,0-61.19,0A24,24,0,0,1,77.71,163a51.22,51.22,0,0,0,24.46-30.67,28,28,0,0,1,51.78,0,51.27,51.27,0,0,0,24.53,30.71A24,24,0,0,1,168,208Z',
      },
    ],
    'music-notes': [
      { tag: 'circle', cx: '180', cy: '172', r: '28', opacity: '0.2' },
      { tag: 'circle', cx: '52', cy: '204', r: '28', opacity: '0.2' },
      {
        tag: 'path',
        d: 'M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.1A36,36,0,1,0,88,196V110.25l112-28v51.85A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216ZM88,93.75V62.25l112-28v31.5ZM180,184a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z',
      },
    ],
    user: [
      { tag: 'circle', cx: '128', cy: '96', r: '64', opacity: '0.2' },
      {
        tag: 'path',
        d: 'M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z',
      },
    ],
  };

  function createPhosphorSvg(iconName, size) {
    const px = size || 14;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ph-icon');
    svg.setAttribute('width', String(px));
    svg.setAttribute('height', String(px));
    svg.setAttribute('viewBox', '0 0 256 256');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');

    const shapes = PHOSPHOR_DUOTONE_SHAPES[iconName] || PHOSPHOR_DUOTONE_SHAPES['sun-dim'];
    for (let i = 0; i < shapes.length; i += 1) {
      const def = shapes[i];
      const child = document.createElementNS(SVG_NS, def.tag);
      if (def.d) child.setAttribute('d', def.d);
      if (def.cx) child.setAttribute('cx', def.cx);
      if (def.cy) child.setAttribute('cy', def.cy);
      if (def.r) child.setAttribute('r', def.r);
      if (def.opacity) child.setAttribute('opacity', def.opacity);
      svg.appendChild(child);
    }
    return svg;
  }

  function setButtonIconAndText(btn, iconName, labelText, size) {
    if (!btn) return;
    clearChildren(btn);
    btn.appendChild(createPhosphorSvg(iconName, size || 14));
    if (typeof labelText === 'string' && labelText.length > 0) {
      btn.appendChild(el('span', '', labelText));
    }
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
    weatherRequestSeq: 0,
    lastWeatherFetchAt: 0,
    lastClockKey: '',
    lastCityStripKey: '',
    lastTelemetryKey: '',
    lastHourlyKey: '',
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
    const daysVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = daysVi[now.getDay()];
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const timeText = `${hh}:${mm}`;
    const dateText = `${dayName}, ${d}/${m}/${y}`;
    const clockKey = `${timeText}|${dateText}`;
    if (state.lastClockKey === clockKey) return;
    state.lastClockKey = clockKey;

    if (timeEl) timeEl.textContent = timeText;
    if (dateEl) dateEl.textContent = dateText;
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
    const cityStripKey = `${state.mode}|${state.config.isGps}|${state.config.locationSource || ''}|${state.config.cityId}|${state.config.locationName}`;
    if (state.lastCityStripKey === cityStripKey && container.childElementCount > 0) return;
    state.lastCityStripKey = cityStripKey;
    clearChildren(container);

    // 1-Tap Current Location GPS / Auto-Locate pill
    const gpsBtn = el(
      'button',
      `city-pill gps-pill${state.config.isGps ? ' active' : ''}`
    );
    gpsBtn.type = 'button';
    gpsBtn.appendChild(createPhosphorSvg('crosshair', 13));
    gpsBtn.appendChild(el('span', '', 'Vị trí hiện tại'));
    gpsBtn.title = state.config.isGps
      ? state.config.locationSource === 'ip'
        ? `Định vị tự động qua mạng: ${state.config.locationName}`
        : `Định vị GPS chính xác: ${state.config.locationName}`
      : 'Tự động định vị vị trí hiện tại (GPS / Wi-Fi / Mạng)';
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
        state.config.locationSource = null;
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
    if (badgeEl) {
      clearChildren(badgeEl);
      badgeEl.appendChild(createPhosphorSvg(decision.badgeIcon || 'sun-dim', 15));
      badgeEl.appendChild(
        el(
          'span',
          '',
          String(decision.badgeVi || 'Thời tiết')
            .replace(/^[^\p{L}\p{N}]+\s*/u, '')
            .trim()
        )
      );
      badgeEl.title = `Trạng thái thời tiết hiện tại: phân loại từ nhiệt độ thực ${Math.round(
        weather.temperatureC
      )}°C (cảm nhận ${Math.round(weather.feelsLikeC)}°C), độ ẩm ${Math.round(
        weather.humidityPct
      )}%, khả năng mưa ${Math.round(weather.precipProbPct)}% và sức gió ${Math.round(
        weather.windSpeedKmh
      )} km/giờ.`;
    }

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
      clearChildren(microAccent);
      const accentIconKey = state.isStanding
        ? decision.sceneId === 'storm_raincoat' || decision.sceneId === 'light_rain_umbrella'
          ? 'drop'
          : !weather.isDay
            ? 'moon-stars'
            : 'sparkle'
        : actionMeta.accentIcon || 'book-open';
      microAccent.appendChild(createPhosphorSvg(accentIconKey, 16));
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

    // Bottom Summary (Temp + 3h Range + Concise Headline + Outfit Advice)
    const hourly3Pts = Array.isArray(weather.hourly) ? weather.hourly.slice(0, 3) : [];
    const temps3Window = [
      Number(weather.temperatureC),
      ...hourly3Pts.map((h) => Number(h && h.temperatureC)),
    ].filter((v) => Number.isFinite(v));
    const safeBaseTemp = Number.isFinite(Number(weather.temperatureC)) ? Number(weather.temperatureC) : 26;
    const loTemp3 = Math.round(temps3Window.length > 0 ? Math.min(...temps3Window) : safeBaseTemp);
    const hiTemp3 = Math.round(temps3Window.length > 0 ? Math.max(...temps3Window) : safeBaseTemp);

    const heroTemp = document.getElementById('hero-temp');
    if (heroTemp) {
      heroTemp.textContent = `${Math.round(weather.temperatureC)}°`;
      heroTemp.title = `Nhiệt độ không khí thực tế hiện tại là ${Math.round(
        weather.temperatureC
      )}°C (cảm nhận ${Math.round(weather.feelsLikeC)}°C).`;
    }

    const feelsTag = document.getElementById('feels-like-tag');
    if (feelsTag) {
      feelsTag.textContent = `Cảm nhận ${Math.round(
        weather.feelsLikeC
      )}°C · Biên nhiệt 3h: ${loTemp3}°–${hiTemp3}°C`;
      feelsTag.title =
        'Nhiệt độ cảm nhận tính cả độ ẩm và sức gió lên cơ thể; biên nhiệt 3h cho biết khoảng dao động thấp nhất – cao nhất trong 3 tiếng sắp tới.';
    }

    const headlineEl = document.getElementById('decision-headline');
    if (headlineEl) {
      headlineEl.textContent = decision.headlineVi;
      headlineEl.title = `Tóm tắt trạng thái khí tượng thời gian thực: ${weather.conditionText}.`;
    }

    const outfitEl = document.getElementById('decision-outfit');
    if (outfitEl) {
      outfitEl.textContent = decision.outfitAdviceVi;
      outfitEl.title =
        'Lời khuyên trang phục & bảo vệ sức khỏe được tính toán tự động từ nhiệt độ cảm nhận, biên nhiệt 3 giờ tới, khả năng mưa, bức xạ tia cực tím và độ sạch không khí.';
    }

    // Foresight Banners
    const alertsBox = document.getElementById('foresight-alerts');
    if (alertsBox) {
      clearChildren(alertsBox);
      if (decision.hasRainAheadProp && decision.rainAheadHours !== null) {
        const rainBanner = el('div', 'foresight-banner rain');
        rainBanner.title =
          'Cảnh báo mưa sắp tới: dự báo trong vài giờ tới khu vực của bạn có xác suất mưa tăng cao, nên mang sẵn ô gấp hoặc áo mưa.';
        rainBanner.appendChild(createPhosphorSvg('umbrella', 15));
        rainBanner.appendChild(
          el(
            'span',
            '',
            `Dự báo có mưa sau ${decision.rainAheadHours} giờ tới · Nhớ mang sẵn ô`
          )
        );
        alertsBox.appendChild(rainBanner);
      }
      if (decision.hasAqiMask) {
        const aqiBanner = el('div', 'foresight-banner aqi');
        aqiBanner.title =
          'Độ sạch không khí & Bụi mịn: đo mật độ bụi mịn PM2.5 và khí thải trong không khí (thang 0–500). Mức trên 130 là ô nhiễm bụi mịn cao, cần đeo khẩu trang lọc bụi.';
        aqiBanner.appendChild(createPhosphorSvg('shield-warning', 15));
        aqiBanner.appendChild(
          el(
            'span',
            '',
            typeof weather.aqi === 'number'
              ? `Bụi mịn cao (${Math.round(weather.aqi)}) · Nên đeo khẩu trang lọc bụi mịn`
              : 'Ô nhiễm bụi mịn cao · Nên đeo khẩu trang lọc bụi mịn'
          )
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
      const ver = w.verification;
      if (ver && ver.consensusLevel === 'verified_multi_source' && typeof ver.confidencePct === 'number') {
        const srcCount = Array.isArray(ver.sourcesChecked) ? ver.sourcesChecked.length : 2;
        providerPill.textContent = `Đối chiếu ${srcCount} nguồn · ${ver.confidencePct}%`;
        providerPill.title = ver.summaryVi || 'Đã đối chiếu đa nguồn từ trạm khí tượng sân bay và mô hình ECMWF.';
      } else if (ver && ver.consensusLevel === 'model_consensus' && typeof ver.confidencePct === 'number') {
        providerPill.textContent = `Đối chiếu mô hình · ${ver.confidencePct}%`;
        providerPill.title = ver.summaryVi || 'Đã đối chiếu chéo hai mô hình khí tượng.';
      } else {
        providerPill.textContent = labelMap[w.provider] || 'Open-Meteo Live';
        providerPill.title =
          (ver && ver.summaryVi) || 'Nguồn dữ liệu chỉ số khí tượng thời gian thực.';
      }
    }

    const metricsGrid = document.getElementById('metrics-grid');
    if (metricsGrid) {
      const pts3 = Array.isArray(w.hourly) ? w.hourly.slice(0, 3) : [];
      const temps3 = [
        Number(w.temperatureC),
        ...pts3.map((h) => Number(h && h.temperatureC)),
      ].filter((v) => Number.isFinite(v));
      const baseTemp = Number.isFinite(Number(w.temperatureC)) ? Number(w.temperatureC) : 26;
      const lo3 = Math.round(temps3.length > 0 ? Math.min(...temps3) : baseTemp);
      const hi3 = Math.round(temps3.length > 0 ? Math.max(...temps3) : baseTemp);
      const aqiNum = typeof w.aqi === 'number' && Number.isFinite(w.aqi) ? Math.round(w.aqi) : null;
      const telemetryKey = `${w.precipProbPct}|${w.precipMmPerHr}|${w.windSpeedKmh}|${w.windGustKmh}|${w.humidityPct}|${w.isDay}|${w.uvIndex}|${aqiNum}|${lo3}|${hi3}|${state.config.sensitivity}`;
      if (state.lastTelemetryKey !== telemetryKey || metricsGrid.childElementCount === 0) {
        state.lastTelemetryKey = telemetryKey;
        clearChildren(metricsGrid);

        const aqiValueVi =
          aqiNum === null
            ? 'Trong lành'
            : aqiNum >= 130
              ? `Bụi mịn cao (${aqiNum})`
              : aqiNum >= 101
                ? `Kém (${aqiNum})`
                : aqiNum >= 51
                  ? `Trung bình (${aqiNum})`
                  : `Trong lành (${aqiNum})`;

        const items = [
          {
            label: 'Khả năng mưa & Lượng mưa',
            value: `${w.precipProbPct}%`,
            sub:
              w.precipProbPct >= 50
                ? `${w.precipMmPerHr} mm/giờ · Mang sẵn ô`
                : `${w.precipMmPerHr} mm/giờ · Trời khô ráo`,
            explain:
              'Phần trăm (%) là khả năng xuất hiện mưa; mm/giờ là độ dày lớp nước mưa rơi trong 1 giờ (trên 50% nên chuẩn bị ô hoặc áo mưa).',
          },
          {
            label: 'Sức gió & Gió giật',
            value: `${Math.round(w.windSpeedKmh)} km/giờ`,
            sub:
              w.windGustKmh >= 32
                ? `Giật ${Math.round(w.windGustKmh)} km/giờ · Giữ vững tay lái`
                : `Gió giật ${Math.round(w.windGustKmh)} km/giờ · Êm ả`,
            explain:
              'Gió đều là tốc độ gió thổi ổn định; gió giật là luồng gió thốc mạnh đột ngột trong vài giây (trên 32 km/giờ cần chú ý khi đi xe máy).',
          },
          {
            label: 'Độ ẩm không khí',
            value: `${w.humidityPct}%`,
            sub:
              w.humidityPct >= 80
                ? 'Ẩm cao · Mặc vải thoáng mồ hôi'
                : w.humidityPct <= 45
                  ? 'Khô hanh · Uống thêm nước'
                  : 'Độ ẩm cân bằng dễ chịu',
            explain:
              'Độ ẩm tương đối (%) cho biết lượng hơi nước trong không khí: trên 80% gây cảm giác hầm bí, lâu khô mồ hôi; dưới 45% trời khô hanh.',
          },
          {
            label: w.isDay ? 'Bức xạ tia cực tím' : 'Bức xạ mặt trời (Đêm)',
            value: w.isDay ? `Mức ${w.uvIndex}` : 'Đêm · Mức 0',
            sub: !w.isDay
              ? 'Ban đêm · Không cần chống nắng'
              : w.uvIndex >= 6
                ? 'Cần che nắng & đeo kính râm'
                : 'Mức an toàn cho da',
            explain:
              'Đo cường độ tia tử ngoại (tia cực tím) từ mặt trời tác động lên da và mắt: 0–2 Thấp, 3–5 Trung bình, 6–7 Cao, từ 8 trở lên Rất gắt.',
          },
          {
            label: 'Độ sạch không khí (Bụi mịn)',
            value: aqiValueVi,
            sub:
              (aqiNum || 0) >= 130
                ? 'Nên đeo khẩu trang lọc bụi mịn'
                : (aqiNum || 0) >= 101
                  ? 'Người nhạy cảm nên đeo khẩu trang'
                  : 'Không khí thoáng đãng, an toàn',
            explain:
              'Đo nồng độ bụi mịn PM2.5 và khí thải trong không khí (thang 0–500): 0–50 Trong lành, 51–100 Trung bình, 101–150 Kém cho người nhạy cảm, trên 150 Ô nhiễm cao.',
          },
          {
            label: 'Biên nhiệt 3h & Cơ địa',
            value: `${lo3}°–${hi3}°C`,
            sub:
              state.config.sensitivity === 'cold_sensitive'
                ? 'Sợ lạnh (-3°C) · Ưu tiên giữ ấm'
                : state.config.sensitivity === 'heat_sensitive'
                  ? 'Sợ nóng (+3°C) · Ưu tiên đồ mát'
                  : 'Cơ địa bình thường · Chuẩn nhiệt kế',
            explain:
              'Khoảng dao động nhiệt độ thấp nhất – cao nhất trong 3 tiếng sắp tới kết hợp với độ nhạy nhiệt của bạn để đưa ra lời khuyên trang phục thời gian thực.',
          },
        ];

        items.forEach((m) => {
          const tile = el('div', 'metric-tile');
          tile.title = m.explain;
          tile.appendChild(el('div', 'metric-label', m.label));
          tile.appendChild(el('div', 'metric-value tabular', m.value));
          tile.appendChild(el('div', 'metric-sub', m.sub));
          metricsGrid.appendChild(tile);
        });
      }
    }

    const hourlyStrip = document.getElementById('hourly-strip');
    if (hourlyStrip) {
      const points = (w.hourly || []).slice(0, 12);
      const hourlyKey = points
        .map((pt) => `${pt.timeIso}|${Math.round(pt.temperatureC)}|${pt.precipProbPct}`)
        .join(';');
      if (state.lastHourlyKey !== hourlyKey || (points.length > 0 && hourlyStrip.childElementCount === 0)) {
        state.lastHourlyKey = hourlyKey;
        clearChildren(hourlyStrip);
        points.forEach((pt, idx) => {
          const hourLabel = formatHourLabel(pt.timeIso, idx);
          const card = el('div', 'hour-pill');
          card.title = `Dự báo lúc ${hourLabel}: nhiệt độ ${Math.round(
            pt.temperatureC
          )}°C, khả năng mưa ${pt.precipProbPct}%.`;
          card.appendChild(el('div', 'hour-time tabular', hourLabel));
          card.appendChild(el('div', 'hour-temp tabular', `${Math.round(pt.temperatureC)}°`));
          card.appendChild(el('div', 'hour-rain tabular', `${pt.precipProbPct}% mưa`));
          hourlyStrip.appendChild(card);
        });
      }
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

    const pinBtn = document.getElementById('widget-btn-pin');
    if (pinBtn) {
      pinBtn.classList.toggle('active', Boolean(cfg.alwaysOnTop));
    }
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
    if (!state.config.autoRotateNpc || document.hidden) return;
    state.npcRotationTimerId = setInterval(() => {
      if (!state.isStanding && !document.hidden) {
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
    state.weatherRequestSeq += 1;
    const reqSeq = state.weatherRequestSeq;
    state.isLoadingWeather = true;
    const refreshBtn = document.getElementById('btn-refresh-weather');
    const isIconOnlyRefresh = state.mode === 'popup' || state.mode === 'widget';
    const defaultRefreshLabel =
      refreshBtn && refreshBtn.hasAttribute('data-label')
        ? refreshBtn.getAttribute('data-label')
        : isIconOnlyRefresh
          ? ''
          : state.mode === 'options'
            ? 'Làm mới thời tiết'
            : 'Làm mới';
    if (refreshBtn) {
      setButtonIconAndText(
        refreshBtn,
        'clock',
        defaultRefreshLabel === '' || isIconOnlyRefresh ? '' : 'Đang tải...',
        14
      );
    }

    try {
      const snapshot = await fetchLiveWeatherWithFallback(state.config);
      if (reqSeq !== state.weatherRequestSeq) {
        return;
      }
      state.weather = snapshot;
      state.lastWeatherFetchAt = Date.now();
      await saveWeatherCache(snapshot);
      recomputeDecisionAndRender();
    } catch (err) {
      if (reqSeq === state.weatherRequestSeq) {
        showToast(`Đang dùng dữ liệu bộ nhớ đệm (${redactSecrets(err && err.message)})`);
      }
    } finally {
      if (reqSeq === state.weatherRequestSeq) {
        state.isLoadingWeather = false;
        if (refreshBtn) {
          setButtonIconAndText(refreshBtn, 'arrows-clockwise', defaultRefreshLabel, 14);
        }
      }
    }
  }

  async function handleSelectCurrentLocation(opts) {
    const silent = Boolean(opts && opts.silent);
    if (!silent) {
      showToast('Đang tự động xác định vị trí địa phương...');
    }

    // Tier 1 & Tier 2: Browser Geolocation (High-Accuracy GPS -> Standard Wi-Fi/OS Location)
    if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
      let geoPos = null;
      try {
        geoPos = await getBrowserPositionPromise({
          enableHighAccuracy: true,
          timeout: 4500,
          maximumAge: 60000,
        });
      } catch (tier1Err) {
        if (!tier1Err || tier1Err.code !== 1) {
          try {
            geoPos = await getBrowserPositionPromise({
              enableHighAccuracy: false,
              timeout: 3000,
              maximumAge: 300000,
            });
          } catch {
            geoPos = null;
          }
        }
      }

      if (geoPos && geoPos.coords) {
        const lat = Math.round(geoPos.coords.latitude * 10000) / 10000;
        const lon = Math.round(geoPos.coords.longitude * 10000) / 10000;
        const nameVi = await reverseGeocodeVi(lat, lon);
        state.config.isGps = true;
        state.config.locationSource = 'gps';
        state.config.cityId = 'gps_current';
        state.config.latitude = lat;
        state.config.longitude = lon;
        state.config.locationName = nameVi;
        await saveConfig(state.config);
        renderCityStrip();
        if (!silent) {
          showToast(`Đã cập nhật GPS: ${nameVi}`);
        }
        await refreshWeatherNow();
        return;
      }
    }

    // Tier 3: Resilient Network/IP Auto-Locate Cascade
    // (localhost:8787/api/auto-locate -> ipwho.is -> BigDataCloud client-IP)
    const networkLoc = await autoLocateViaNetworkFallback();
    if (networkLoc) {
      state.config.isGps = true;
      state.config.locationSource = 'ip';
      state.config.cityId = 'gps_current';
      state.config.latitude = networkLoc.latitude;
      state.config.longitude = networkLoc.longitude;
      state.config.locationName = networkLoc.locationName;
      await saveConfig(state.config);
      renderCityStrip();
      if (!silent) {
        showToast(`Đã định vị tự động: ${networkLoc.locationName}`);
      }
      await refreshWeatherNow();
      return;
    }

    if (!silent) {
      showToast('Không thể định vị tự động lúc này. Hãy chọn thành phố trên thanh trên.');
    }
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
        showToast(`Đã mở Widget màn hình Windows tại góc ${payload.corner}!`);
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
    showToast('Đã mở cửa sổ Widget nổi ở góc màn hình!');
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
    // Stage click & keyboard activation -> Spring Stand-Up into weather outfit for 8.5s
    const stageViewport = document.getElementById('character-stage-viewport');
    if (stageViewport) {
      stageViewport.addEventListener('click', () => {
        triggerStandUpPose();
      });
      stageViewport.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerStandUpPose();
        }
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer && drawer.classList.contains('open') && state.mode !== 'options') {
        toggleDrawer(false);
      }
    });

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
            ? 'Đã bật Ghim nổi trên mọi cửa sổ'
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
    const applyWidgetSizeWindow = (sizeMode) => {
      if (state.mode !== 'widget') return;
      if (
        window.weatherBuddyDesktop &&
        typeof window.weatherBuddyDesktop.setSizeMode === 'function'
      ) {
        window.weatherBuddyDesktop.setSizeMode(sizeMode);
      } else {
        try {
          window.resizeTo(
            sizeMode === 'Compact' ? 310 : 388,
            sizeMode === 'Compact' ? 430 : 550
          );
        } catch {
          // Ignore if browser restricts resizeTo
        }
      }
    };

    const bindCheckbox = (id, key) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener('change', () => {
        state.config[key] = Boolean(node.checked);
        if (key === 'compactMode') {
          state.config.widgetSize = node.checked ? 'Compact' : 'Standard';
          applyWidgetSizeWindow(state.config.widgetSize);
        }
        if (key === 'alwaysOnTop' && state.mode === 'widget') {
          if (
            window.weatherBuddyDesktop &&
            typeof window.weatherBuddyDesktop.setAlwaysOnTop === 'function'
          ) {
            window.weatherBuddyDesktop.setAlwaysOnTop(state.config.alwaysOnTop);
          }
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
          applyWidgetSizeWindow(node.value);
        } else if (key === 'widgetCorner' && state.mode === 'widget') {
          snapDesktopWidgetWindow(node.value);
          recomputeDecisionAndRender();
          return;
        }
        saveConfig(state.config);
        recomputeDecisionAndRender();
        if (key === 'provider') {
          refreshWeatherNow();
        }
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
        showToast('Đã lưu cấu hình API Key cá nhân an toàn vào bộ nhớ cục bộ.');
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
        const nextLabel =
          state.mode === 'popup' || state.mode === 'widget' ? '' : isMasked ? 'Ẩn' : 'Hiện';
        setButtonIconAndText(btn, isMasked ? 'eye-slash' : 'eye', nextLabel, 14);
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
        showToast('Đã xuất tệp cấu hình (đã ẩn API Key bảo mật).');
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
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('Invalid JSON object');
            }
            const sanitized = {};
            const allowedKeys = Object.keys(DEFAULT_CONFIG);
            for (let i = 0; i < allowedKeys.length; i += 1) {
              const k = allowedKeys[i];
              if (Object.prototype.hasOwnProperty.call(parsed, k)) {
                sanitized[k] = parsed[k];
              }
            }
            if (
              sanitized.latitude !== undefined &&
              (!Number.isFinite(Number(sanitized.latitude)) ||
                Number(sanitized.latitude) < -90 ||
                Number(sanitized.latitude) > 90)
            ) {
              delete sanitized.latitude;
            }
            if (
              sanitized.longitude !== undefined &&
              (!Number.isFinite(Number(sanitized.longitude)) ||
                Number(sanitized.longitude) < -180 ||
                Number(sanitized.longitude) > 180)
            ) {
              delete sanitized.longitude;
            }
            state.config = Object.assign({}, DEFAULT_CONFIG, state.config, sanitized);
            await saveConfig(state.config);
            recomputeDecisionAndRender();
            showToast('Đã nhập cấu hình WeatherBuddy thành công!');
            await refreshWeatherNow();
          } catch {
            showToast('Tệp JSON không hợp lệ.');
          } finally {
            importFile.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  }

  function startBackgroundTimers() {
    if (!state.clockTimerId && state.mode === 'newtab') {
      state.clockTimerId = setInterval(updateClockDom, 15000);
    }
    if (!state.weatherTimerId) {
      state.weatherTimerId = setInterval(refreshWeatherNow, WEATHER_REFRESH_INTERVAL_MS);
    }
    restartNpcRotationTimer();
  }

  function stopBackgroundTimers() {
    if (state.clockTimerId) {
      clearInterval(state.clockTimerId);
      state.clockTimerId = null;
    }
    if (state.weatherTimerId) {
      clearInterval(state.weatherTimerId);
      state.weatherTimerId = null;
    }
    if (state.npcRotationTimerId) {
      clearInterval(state.npcRotationTimerId);
      state.npcRotationTimerId = null;
    }
  }

  function handleVisibilityChange() {
    const hidden = Boolean(document.hidden);
    document.body.classList.toggle('tab-hidden', hidden);
    if (hidden) {
      stopBackgroundTimers();
    } else {
      updateClockDom();
      startBackgroundTimers();
      if (Date.now() - state.lastWeatherFetchAt >= WEATHER_REFRESH_INTERVAL_MS) {
        refreshWeatherNow();
      }
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
      const now = new Date();
      const nowHour = now.getHours();
      const isDay = nowHour >= 6 && nowHour < 18;
      state.weather = {
        provider: 'open_meteo',
        locationName: state.config.locationName || 'Hà Nội',
        latitude: state.config.latitude,
        longitude: state.config.longitude,
        updatedAtIso: now.toISOString(),
        utcOffsetSeconds: -now.getTimezoneOffset() * 60,
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
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.body.classList.toggle('tab-hidden', Boolean(document.hidden));

    recomputeDecisionAndRender();
    if (!document.hidden) {
      startBackgroundTimers();
    }

    // Auto-detect real local city on first fresh launch when no config was previously saved
    if (!hasPersistedConfig) {
      const initialLoc = await autoLocateViaNetworkFallback();
      if (initialLoc) {
        state.config.isGps = true;
        state.config.locationSource = 'ip';
        state.config.cityId = 'gps_current';
        state.config.latitude = initialLoc.latitude;
        state.config.longitude = initialLoc.longitude;
        state.config.locationName = initialLoc.locationName;
        await saveConfig(state.config);
        renderCityStrip();
      }
    }

    await refreshWeatherNow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
