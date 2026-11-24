import type { HourlyForecastPoint, WeatherSnapshot } from './types';
import { inferAstronomicalDaytime } from './solarTime';

const WEATHERAPI_FORECAST_URL = 'https://api.weatherapi.com/v1/forecast.json';

interface WeatherApiCondition {
  code?: number;
  text?: string;
}

interface WeatherApiAirQuality {
  pm2_5?: number;
  'us-epa-index'?: number;
}

interface WeatherApiCurrent {
  last_updated_epoch?: number;
  last_updated?: string;
  temp_c?: number;
  feelslike_c?: number;
  is_day?: number;
  humidity?: number;
  wind_kph?: number;
  gust_kph?: number;
  precip_mm?: number;
  uv?: number;
  condition?: WeatherApiCondition;
  air_quality?: WeatherApiAirQuality;
}

interface WeatherApiHour {
  time_epoch?: number;
  time?: string;
  temp_c?: number;
  precip_mm?: number;
  chance_of_rain?: number;
  condition?: WeatherApiCondition;
}

interface WeatherApiForecastResponse {
  location?: {
    localtime?: string;
    localtime_epoch?: number;
    tz_id?: string;
  };
  current?: WeatherApiCurrent;
  forecast?: {
    forecastday?: Array<{
      hour?: WeatherApiHour[];
    }>;
  };
}

function inferWeatherApiOffsetSeconds(
  data: WeatherApiForecastResponse
): number | undefined {
  const pairs: Array<[string | undefined, number | undefined]> = [
    [data.location?.localtime, data.location?.localtime_epoch],
    [data.current?.last_updated, data.current?.last_updated_epoch],
  ];

  for (const [localStr, epochSec] of pairs) {
    if (localStr && typeof epochSec === 'number' && Number.isFinite(epochSec)) {
      const m = localStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
      if (m) {
        const wallUtcSec = Math.floor(
          Date.UTC(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3]),
            Number(m[4]),
            Number(m[5])
          ) / 1000
        );
        const approxOffset = Math.round((wallUtcSec - epochSec) / 900) * 900;
        if (Number.isFinite(approxOffset) && Math.abs(approxOffset) <= 14 * 3600) {
          return approxOffset;
        }
      }
    }
  }

  const tzId = data.location?.tz_id?.trim();
  if (tzId) {
    try {
      const refSec =
        data.current?.last_updated_epoch ??
        data.location?.localtime_epoch ??
        Math.floor(Date.now() / 1000);
      const refMs = refSec * 1000;
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tzId,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(refMs));
      const pick = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value ?? NaN);
      const wallMs = Date.UTC(
        pick('year'),
        pick('month') - 1,
        pick('day'),
        pick('hour'),
        pick('minute'),
        pick('second')
      );
      if (Number.isFinite(wallMs)) {
        return Math.round((wallMs - refMs) / 60_000) * 60;
      }
    } catch {
      // Ignore unsupported timezone IDs
    }
  }

  return undefined;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function clampPct(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100, Math.round(val)));
}

/**
 * Convert PM2.5 (µg/m³) into standard US EPA AQI (0–500) so WeatherAPI.com
 * triggers the AQI mask threshold (>= 130) identically to Open-Meteo.
 */
export function pm25ToUsAqi(pm25: number | undefined): number | undefined {
  if (typeof pm25 !== 'number' || !Number.isFinite(pm25) || pm25 < 0) {
    return undefined;
  }
  const c = Math.floor(pm25 * 10) / 10;
  const breakpoints: Array<[number, number, number, number]> = [
    [0.0, 9.0, 0, 50],
    [9.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300],
    [225.5, 325.4, 301, 500],
  ];
  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (c <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow);
    }
  }
  return 500;
}

export function mapWeatherApiConditionCode(code: number | undefined): string {
  if (code === undefined) return 'PARTLY_CLOUDY';
  if (code === 1000) return 'CLEAR';
  if (code === 1003) return 'PARTLY_CLOUDY';
  if (code === 1006 || code === 1009) return 'CLOUDY';
  if (code === 1030 || code === 1135 || code === 1147) return 'FOG';
  if (code === 1087 || code >= 1273) return 'THUNDERSTORM';
  if (code === 1192 || code === 1195 || code === 1243 || code === 1246) {
    return 'HEAVY_RAIN';
  }
  if (code >= 1150 && code <= 1183) return 'LIGHT_RAIN';
  if (code >= 1063 && code <= 1252) return 'RAIN';
  return 'PARTLY_CLOUDY';
}

export function buildWeatherApiUrl(lat: number, lon: number, apiKey: string): string {
  const params = new URLSearchParams({
    key: apiKey,
    q: `${lat},${lon}`,
    days: '2',
    aqi: 'yes',
    alerts: 'no',
    lang: 'vi',
  });
  return `${WEATHERAPI_FORECAST_URL}?${params.toString()}`;
}

export function mapWeatherApiResponse(
  data: WeatherApiForecastResponse,
  lat: number,
  lon: number,
  locationName: string
): WeatherSnapshot {
  const current = data.current ?? {};
  const updatedAtIso = current.last_updated_epoch
    ? new Date(current.last_updated_epoch * 1000).toISOString()
    : new Date().toISOString();
  const utcOffsetSeconds = inferWeatherApiOffsetSeconds(data);
  const isDay =
    typeof current.is_day === 'number'
      ? current.is_day === 1
      : inferAstronomicalDaytime(updatedAtIso, lat, lon, utcOffsetSeconds);
  const temperatureC = round1(current.temp_c ?? 26);
  const feelsLikeC = round1(current.feelslike_c ?? temperatureC);
  const humidityPct = clampPct(current.humidity ?? 70);
  const windSpeedKmh = Math.max(0, round1(current.wind_kph ?? 0));
  const windGustKmh = Math.max(windSpeedKmh, round1(current.gust_kph ?? windSpeedKmh));
  const uvIndex = Math.max(0, round1(current.uv ?? 0));
  const precipMmPerHr = Math.max(0, round2(current.precip_mm ?? 0));

  const allHours: WeatherApiHour[] = (data.forecast?.forecastday ?? []).flatMap(
    (day) => day.hour ?? []
  );
  const nowEpoch =
    current.last_updated_epoch ??
    data.location?.localtime_epoch ??
    Math.floor(Date.now() / 1000);

  const upcomingHours = allHours.filter(
    (h) => (h.time_epoch ?? 0) > nowEpoch
  );
  const currentHourSlot =
    allHours.find((h) => Math.abs((h.time_epoch ?? 0) - nowEpoch) <= 1800) ??
    upcomingHours[0];

  const precipProbPct = clampPct(
    currentHourSlot?.chance_of_rain ?? (precipMmPerHr >= 0.2 ? 70 : 10)
  );

  const hourly: HourlyForecastPoint[] = upcomingHours.slice(0, 24).map((h) => ({
    timeIso: h.time_epoch
      ? new Date(h.time_epoch * 1000).toISOString()
      : new Date().toISOString(),
    temperatureC: round1(h.temp_c ?? temperatureC),
    precipProbPct: clampPct(h.chance_of_rain ?? 0),
    precipMm: Math.max(0, round2(h.precip_mm ?? 0)),
    conditionCode: mapWeatherApiConditionCode(h.condition?.code),
  }));

  const aqi = pm25ToUsAqi(current.air_quality?.pm2_5);

  const snapshot: WeatherSnapshot = {
    provider: 'weatherapi',
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
    conditionText:
      current.condition?.text?.trim() || (isDay ? 'Thời tiết dịu nhẹ' : 'Đêm mát mẻ'),
    isDay,
    hourly,
  };

  if (typeof utcOffsetSeconds === 'number') {
    snapshot.utcOffsetSeconds = utcOffsetSeconds;
  }

  if (typeof aqi === 'number') {
    snapshot.aqi = aqi;
  }

  return snapshot;
}

export async function fetchWeatherApiWeather(
  lat: number,
  lon: number,
  locationName: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<WeatherSnapshot> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('Thiếu WeatherAPI.com API Key.');
  }

  const res = await fetchImpl(buildWeatherApiUrl(lat, lon, trimmed), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `WeatherAPI.com failed (HTTP ${res.status}): ${errText.slice(0, 220)}`
    );
  }

  const data = (await res.json()) as WeatherApiForecastResponse;
  return mapWeatherApiResponse(data, lat, lon, locationName);
}
