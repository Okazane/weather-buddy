/**
 * WeatherBuddy Manifest V3 Background Service Worker
 * - Schedules 15-minute chrome.alarms weather refresh
 * - Updates browser toolbar badge ("27°") with atmospheric slate/blue badge color
 * - Zero hardcoded API keys (uses Open-Meteo Free by default, or user-supplied keys in chrome.storage.local)
 */

const ALARM_NAME = 'weatherbuddy-refresh-15m';
const STORAGE_KEY = 'weatherbuddy_pc_config_v3';
const CACHE_KEY = 'weatherbuddy_pc_weather_cache_v3';

const DEFAULT_LOCATION = {
  id: 'ha_noi',
  nameVi: 'Hà Nội',
  regionVi: 'Miền Bắc',
  latitude: 21.0285,
  longitude: 105.8542,
};

function getStoredData(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (res) => resolve(res || {}));
    } catch {
      resolve({});
    }
  });
}

function mapWmoToShortVi(code, isDay) {
  switch (code) {
    case 0:
      return isDay ? 'Trời nắng quang đãng' : 'Đêm quang đãng';
    case 1:
      return isDay ? 'Nắng nhẹ dễ chịu' : 'Đêm ít mây';
    case 2:
      return 'Có mây rải rác';
    case 3:
      return 'Trời nhiều mây';
    case 45:
    case 48:
      return 'Có sương mù nhẹ';
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return 'Mưa phùn lất phất';
    case 61:
    case 80:
      return 'Mưa nhỏ rải rác';
    case 63:
    case 81:
      return 'Mưa rào vừa';
    case 65:
    case 66:
    case 67:
    case 82:
      return 'Mưa to nặng hạt';
    case 95:
    case 96:
    case 99:
      return 'Mưa dông kèm gió giật';
    default:
      return isDay ? 'Thời tiết dịu nhẹ' : 'Đêm mát mẻ';
  }
}

async function fetchOpenMeteoSnapshot(lat, lon, locationName) {
  const params = new URLSearchParams({
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
    minutely_15: 'precipitation',
    forecast_minutely_15: '2',
    timezone: 'auto',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }
  const data = await res.json();
  const cur = data.current || {};
  const isDay = (cur.is_day ?? 1) === 1;
  const temperatureC = Math.round((cur.temperature_2m ?? 26) * 10) / 10;
  const feelsLikeC = Math.round((cur.apparent_temperature ?? temperatureC) * 10) / 10;
  const min15 = ((data.minutely_15 && data.minutely_15.precipitation) || [])
    .slice(0, 2)
    .reduce((m, v) => Math.max(m, typeof v === 'number' ? v : 0), 0);
  const precipMmPerHr = Math.max(0, Number(cur.precipitation ?? 0), min15 * 4);
  const precipProbPct = Math.max(0, Math.min(100, Math.round(cur.precipitation_probability ?? 0)));
  const conditionText = mapWmoToShortVi(cur.weather_code, isDay);

  return {
    provider: 'open_meteo',
    locationName,
    latitude: lat,
    longitude: lon,
    updatedAtIso: new Date().toISOString(),
    temperatureC,
    feelsLikeC,
    precipMmPerHr,
    precipProbPct,
    conditionText,
    isDay,
  };
}

async function updateBadgeFromWeather(snapshot) {
  if (!snapshot || typeof snapshot.temperatureC !== 'number') {
    return;
  }
  const roundedTemp = Math.round(snapshot.temperatureC);
  const badgeText = `${roundedTemp}°`;

  let badgeColor = '#185ADB'; // Clean calibrated cobalt blue
  if (snapshot.precipMmPerHr >= 0.2 || snapshot.precipProbPct >= 55) {
    badgeColor = '#0284C7'; // Rain slate cyan
  } else if (!snapshot.isDay) {
    badgeColor = '#1E293B'; // Crisp night slate
  }

  try {
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: '#F8FAFC' });
    }
    const title = `WeatherBuddy · ${snapshot.locationName || 'Việt Nam'} ${roundedTemp}°C (Cảm nhận ${Math.round(snapshot.feelsLikeC ?? roundedTemp)}°C) · ${snapshot.conditionText || ''}`;
    await chrome.action.setTitle({ title });
  } catch {
    // Ignore if action API not ready
  }
}

async function refreshWeatherAndBadge() {
  try {
    const stored = await getStoredData([STORAGE_KEY, CACHE_KEY]);
    const config = stored[STORAGE_KEY] || {};
    const lat = Number.isFinite(Number(config.latitude))
      ? Number(config.latitude)
      : DEFAULT_LOCATION.latitude;
    const lon = Number.isFinite(Number(config.longitude))
      ? Number(config.longitude)
      : DEFAULT_LOCATION.longitude;
    const locationName = config.locationName || DEFAULT_LOCATION.nameVi;

    const snapshot = await fetchOpenMeteoSnapshot(lat, lon, locationName);
    await updateBadgeFromWeather(snapshot);
  } catch {
    const stored = await getStoredData([CACHE_KEY]);
    if (stored[CACHE_KEY] && stored[CACHE_KEY].snapshot) {
      await updateBadgeFromWeather(stored[CACHE_KEY].snapshot);
    }
  }
}

function ensureAlarmScheduled() {
  try {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: 15,
    });
  } catch {
    // Ignore
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarmScheduled();
  refreshWeatherAndBadge();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarmScheduled();
  refreshWeatherAndBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === ALARM_NAME) {
    refreshWeatherAndBadge();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (message.type === 'WEATHER_SNAPSHOT_UPDATED' && message.snapshot) {
    updateBadgeFromWeather(message.snapshot).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'REFRESH_BADGE') {
    refreshWeatherAndBadge().then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
