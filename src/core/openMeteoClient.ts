import type { HourlyForecastPoint, WeatherSnapshot } from './types';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

interface OpenMeteoForecastResponse {
  utc_offset_seconds?: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    precipitation?: number;
    precipitation_probability?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    uv_index?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    weather_code?: number[];
    uv_index?: number[];
  };
  minutely_15?: {
    time?: string[];
    precipitation?: number[];
  };
}

interface OpenMeteoAirQualityResponse {
  current?: {
    us_aqi?: number;
  };
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

function formatOffsetSuffix(utcOffsetSeconds?: number): string {
  if (typeof utcOffsetSeconds !== 'number' || !Number.isFinite(utcOffsetSeconds)) {
    return 'Z';
  }
  if (utcOffsetSeconds === 0) return 'Z';
  const sign = utcOffsetSeconds >= 0 ? '+' : '-';
  const absMinutes = Math.round(Math.abs(utcOffsetSeconds) / 60);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const minutes = String(absMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function normalizeOpenMeteoIso(localTimeStr: string | undefined, offsetSuffix: string): string {
  if (!localTimeStr) {
    return new Date().toISOString();
  }
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(localTimeStr)) {
    return localTimeStr;
  }
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTimeStr)
    ? `${localTimeStr}:00`
    : localTimeStr;
  return `${withSeconds}${offsetSuffix}`;
}

export function mapWmoWeatherCode(
  code: number | undefined,
  isDay: boolean
): { conditionCode: string; conditionTextVi: string } {
  switch (code) {
    case 0:
      return {
        conditionCode: 'CLEAR',
        conditionTextVi: isDay ? 'Trời nắng quang đãng' : 'Đêm quang đãng',
      };
    case 1:
      return {
        conditionCode: 'MOSTLY_CLEAR',
        conditionTextVi: isDay ? 'Nắng nhẹ dễ chịu' : 'Đêm ít mây',
      };
    case 2:
      return {
        conditionCode: 'PARTLY_CLOUDY',
        conditionTextVi: 'Có mây rải rác',
      };
    case 3:
      return {
        conditionCode: 'CLOUDY',
        conditionTextVi: 'Trời nhiều mây',
      };
    case 45:
    case 48:
      return {
        conditionCode: 'FOG',
        conditionTextVi: 'Có sương mù nhẹ',
      };
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return {
        conditionCode: 'DRIZZLE',
        conditionTextVi: 'Mưa phùn lất phất',
      };
    case 61:
    case 80:
      return {
        conditionCode: 'LIGHT_RAIN',
        conditionTextVi: 'Mưa nhỏ rải rác',
      };
    case 63:
    case 81:
      return {
        conditionCode: 'RAIN',
        conditionTextVi: 'Mưa rào vừa',
      };
    case 65:
    case 66:
    case 67:
    case 82:
      return {
        conditionCode: 'HEAVY_RAIN',
        conditionTextVi: 'Mưa to nặng hạt',
      };
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return {
        conditionCode: 'SNOW',
        conditionTextVi: 'Trời lạnh có tuyết',
      };
    case 95:
    case 96:
    case 99:
      return {
        conditionCode: 'THUNDERSTORM',
        conditionTextVi: 'Mưa dông kèm gió giật',
      };
    default:
      return {
        conditionCode: 'PARTLY_CLOUDY',
        conditionTextVi: isDay ? 'Thời tiết dịu nhẹ' : 'Đêm mát mẻ',
      };
  }
}

export async function fetchOpenMeteoAqi(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch
): Promise<number | undefined> {
  try {
    const aqiParams = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'us_aqi',
    });
    const res = await fetchImpl(`${OPEN_METEO_AIR_QUALITY_URL}?${aqiParams.toString()}`);
    if (!res.ok) return undefined;
    const data = (await res.json()) as OpenMeteoAirQualityResponse;
    const rawAqi = data?.current?.us_aqi;
    if (typeof rawAqi === 'number' && Number.isFinite(rawAqi)) {
      return Math.max(0, Math.round(rawAqi));
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  locationName: string,
  fetchImpl: typeof fetch = fetch
): Promise<WeatherSnapshot> {
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

  const [forecastRes, aqi] = await Promise.all([
    fetchImpl(`${OPEN_METEO_FORECAST_URL}?${forecastParams.toString()}`),
    fetchOpenMeteoAqi(lat, lon, fetchImpl),
  ]);

  if (!forecastRes.ok) {
    const errText = await forecastRes.text().catch(() => '');
    throw new Error(
      `Open-Meteo forecast failed (HTTP ${forecastRes.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = (await forecastRes.json()) as OpenMeteoForecastResponse;
  const current = data.current ?? {};
  const offsetSuffix = formatOffsetSuffix(data.utc_offset_seconds);

  const isDay = (current.is_day ?? 1) === 1;
  const temperatureC = round1(current.temperature_2m ?? 25);
  const feelsLikeC = round1(current.apparent_temperature ?? temperatureC);
  const humidityPct = clampPct(current.relative_humidity_2m ?? 70);
  const windSpeedKmh = Math.max(0, round1(current.wind_speed_10m ?? 0));
  const windGustKmh = Math.max(windSpeedKmh, round1(current.wind_gusts_10m ?? windSpeedKmh));
  const uvIndex = Math.max(0, round1(current.uv_index ?? 0));
  const minutely15MmPer15m = (data.minutely_15?.precipitation ?? [])
    .slice(0, 2)
    .reduce((maxVal, val) => Math.max(maxVal, typeof val === 'number' ? val : 0), 0);
  // Open-Meteo minutely_15 precipitation is mm per 15 minutes; multiply by 4 for mm/hr rate
  const minutely15RatePerHr = minutely15MmPer15m * 4;
  const precipMmPerHr = Math.max(
    0,
    round2(Math.max(current.precipitation ?? 0, minutely15RatePerHr))
  );
  const precipProbPct = clampPct(current.precipitation_probability ?? 0);

  const { conditionTextVi } = mapWmoWeatherCode(current.weather_code, isDay);
  const updatedAtIso = normalizeOpenMeteoIso(current.time, offsetSuffix);

  const hourlyTimes = data.hourly?.time ?? [];
  const hourlyTemps = data.hourly?.temperature_2m ?? [];
  const hourlyProbs = data.hourly?.precipitation_probability ?? [];
  const hourlyPrecip = data.hourly?.precipitation ?? [];
  const hourlyCodes = data.hourly?.weather_code ?? [];

  const currentLocalTime = current.time ?? '';
  let startIdx = 0;
  if (currentLocalTime && hourlyTimes.length > 0) {
    const foundIdx = hourlyTimes.findIndex((t) => t > currentLocalTime);
    startIdx = foundIdx >= 0 ? foundIdx : 0;
  }

  const hourly: HourlyForecastPoint[] = [];
  const endIdx = Math.min(hourlyTimes.length, startIdx + 24);
  for (let i = startIdx; i < endIdx; i += 1) {
    const codeInfo = mapWmoWeatherCode(hourlyCodes[i], true);
    hourly.push({
      timeIso: normalizeOpenMeteoIso(hourlyTimes[i], offsetSuffix),
      temperatureC: round1(hourlyTemps[i] ?? temperatureC),
      precipProbPct: clampPct(hourlyProbs[i] ?? 0),
      precipMm: Math.max(0, round2(hourlyPrecip[i] ?? 0)),
      conditionCode: codeInfo.conditionCode,
    });
  }

  const snapshot: WeatherSnapshot = {
    provider: 'open_meteo',
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
    conditionText: conditionTextVi,
    isDay,
    hourly,
  };

  if (typeof aqi === 'number') {
    snapshot.aqi = aqi;
  }

  return snapshot;
}
