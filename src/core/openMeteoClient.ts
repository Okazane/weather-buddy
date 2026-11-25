import type { DailyForecastPoint, HourlyForecastPoint, WeatherSnapshot } from './types';
import { computeDewPointC, computeSolarAndMoonCycle, inferAstronomicalDaytime } from './solarTime';
import { pm25ToUsAqi } from './weatherApiClient';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

interface OpenMeteoForecastResponse {
  utc_offset_seconds?: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    dew_point_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    precipitation?: number;
    precipitation_probability?: number;
    weather_code?: number;
    surface_pressure?: number;
    visibility?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    uv_index?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    weather_code?: number[];
    uv_index?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    uv_index_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
  minutely_15?: {
    time?: string[];
    precipitation?: number[];
  };
}

interface OpenMeteoAirQualityResponse {
  current?: {
    us_aqi?: number | null;
    pm2_5?: number | null;
    pm10?: number | null;
  };
}

export interface OpenMeteoAirQualityDetails {
  aqi?: number;
  pm25?: number;
  pm10?: number;
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

export async function fetchOpenMeteoAqiDetails(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch
): Promise<OpenMeteoAirQualityDetails> {
  try {
    const aqiParams = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'us_aqi,pm2_5,pm10',
    });
    const res = await fetchImpl(`${OPEN_METEO_AIR_QUALITY_URL}?${aqiParams.toString()}`);
    if (!res.ok) return {};
    const data = (await res.json()) as OpenMeteoAirQualityResponse;
    const rawAqi = data?.current?.us_aqi;
    const rawPm25 = data?.current?.pm2_5;
    const rawPm10 = data?.current?.pm10;
    const validRawAqi =
      typeof rawAqi === 'number' && Number.isFinite(rawAqi) ? rawAqi : undefined;
    const pm25 =
      typeof rawPm25 === 'number' && Number.isFinite(rawPm25) && rawPm25 >= 0
        ? round1(rawPm25)
        : undefined;
    const pm10 =
      typeof rawPm10 === 'number' && Number.isFinite(rawPm10) && rawPm10 >= 0
        ? round1(rawPm10)
        : undefined;
    const pm25Aqi = pm25 !== undefined ? pm25ToUsAqi(pm25) : undefined;

    let aqi: number | undefined;
    if (pm25Aqi !== undefined) {
      if (validRawAqi !== undefined && validRawAqi - pm25Aqi > 22) {
        aqi = Math.max(0, Math.round(pm25Aqi * 0.8 + validRawAqi * 0.2));
      } else {
        aqi = Math.max(0, Math.max(pm25Aqi, Math.round(validRawAqi ?? pm25Aqi)));
      }
    } else if (validRawAqi !== undefined) {
      aqi = Math.max(0, Math.round(validRawAqi));
    }

    return { aqi, pm25, pm10 };
  } catch {
    return {};
  }
}

export async function fetchOpenMeteoAqi(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch
): Promise<number | undefined> {
  const details = await fetchOpenMeteoAqiDetails(lat, lon, fetchImpl);
  return details.aqi;
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
      'dew_point_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'precipitation_probability',
      'weather_code',
      'surface_pressure',
      'visibility',
      'wind_speed_10m',
      'wind_gusts_10m',
      'uv_index',
    ].join(','),
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'uv_index_max',
      'sunrise',
      'sunset',
    ].join(','),
    minutely_15: 'precipitation',
    forecast_minutely_15: '2',
    forecast_days: '7',
    timezone: 'auto',
  });

  const [forecastRes, aqiDetails] = await Promise.all([
    fetchImpl(`${OPEN_METEO_FORECAST_URL}?${forecastParams.toString()}`),
    fetchOpenMeteoAqiDetails(lat, lon, fetchImpl),
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

  const updatedAtIso = normalizeOpenMeteoIso(current.time, offsetSuffix);
  const isDay =
    typeof current.is_day === 'number'
      ? current.is_day === 1
      : inferAstronomicalDaytime(updatedAtIso, lat, lon, data.utc_offset_seconds);
  const temperatureC = round1(current.temperature_2m ?? 25);
  const feelsLikeC = round1(current.apparent_temperature ?? temperatureC);
  const humidityPct = clampPct(current.relative_humidity_2m ?? 70);
  const dewPointC =
    typeof current.dew_point_2m === 'number' && Number.isFinite(current.dew_point_2m)
      ? round1(current.dew_point_2m)
      : computeDewPointC(temperatureC, humidityPct);
  const surfacePressureHpa =
    typeof current.surface_pressure === 'number' && Number.isFinite(current.surface_pressure)
      ? round1(current.surface_pressure)
      : undefined;
  const visibilityKm =
    typeof current.visibility === 'number' && Number.isFinite(current.visibility)
      ? round1(current.visibility / 1000)
      : undefined;
  const solarCycle = computeSolarAndMoonCycle(updatedAtIso, lat, lon, data.utc_offset_seconds);
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

  const wmoCode = current.weather_code;
  let { conditionTextVi } = mapWmoWeatherCode(wmoCode, isDay);
  if (precipMmPerHr >= 4.5 && (wmoCode === undefined || wmoCode < 51)) {
    conditionTextVi = 'Mưa to nặng hạt';
  } else if (precipMmPerHr >= 0.2 && (wmoCode === undefined || wmoCode < 51)) {
    conditionTextVi = 'Mưa nhỏ rải rác';
  } else if (
    precipMmPerHr === 0 &&
    precipProbPct < 45 &&
    wmoCode !== undefined &&
    ((wmoCode >= 51 && wmoCode <= 61) || wmoCode === 80)
  ) {
    conditionTextVi = 'Trời nhiều mây';
  }

  const hourlyTimes = data.hourly?.time ?? [];
  const hourlyTemps = data.hourly?.temperature_2m ?? [];
  const hourlyHumidities = data.hourly?.relative_humidity_2m ?? [];
  const hourlyProbs = data.hourly?.precipitation_probability ?? [];
  const hourlyPrecip = data.hourly?.precipitation ?? [];
  const hourlyCodes = data.hourly?.weather_code ?? [];

  const currentLocalTime = current.time ?? '';
  let startIdx = 0;
  if (currentLocalTime && hourlyTimes.length > 0) {
    const foundIdx = hourlyTimes.findIndex((t) => t > currentLocalTime);
    startIdx = foundIdx >= 0 ? foundIdx : Math.max(0, hourlyTimes.length - 1);
  }

  const hourly: HourlyForecastPoint[] = [];
  const endIdx = Math.min(hourlyTimes.length, startIdx + 24);
  for (let i = startIdx; i < endIdx; i += 1) {
    const codeInfo = mapWmoWeatherCode(hourlyCodes[i], true);
    hourly.push({
      timeIso: normalizeOpenMeteoIso(hourlyTimes[i], offsetSuffix),
      temperatureC: round1(hourlyTemps[i] ?? temperatureC),
      humidityPct: clampPct(hourlyHumidities[i] ?? humidityPct),
      precipProbPct: clampPct(hourlyProbs[i] ?? 0),
      precipMm: Math.max(0, round2(hourlyPrecip[i] ?? 0)),
      conditionCode: codeInfo.conditionCode,
    });
  }

  const dailyTimes = data.daily?.time ?? [];
  const dailyCodes = data.daily?.weather_code ?? [];
  const dailyMaxs = data.daily?.temperature_2m_max ?? [];
  const dailyMins = data.daily?.temperature_2m_min ?? [];
  const dailySums = data.daily?.precipitation_sum ?? [];
  const dailyProbs = data.daily?.precipitation_probability_max ?? [];
  const dailyUvs = data.daily?.uv_index_max ?? [];
  const dailySunrises = data.daily?.sunrise ?? [];
  const dailySunsets = data.daily?.sunset ?? [];

  const extractHm = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    const m = raw.match(/T(\d{2}:\d{2})/);
    return m ? m[1] : undefined;
  };

  const daily: DailyForecastPoint[] = dailyTimes.slice(0, 7).map((dateStr, idx) => {
    const mapped = mapWmoWeatherCode(dailyCodes[idx], true);
    const tMax = round1(dailyMaxs[idx] ?? temperatureC + 2);
    const tMin = round1(dailyMins[idx] ?? temperatureC - 3);
    return {
      dateIso: String(dateStr).slice(0, 10),
      tempMinC: Math.min(tMin, tMax),
      tempMaxC: Math.max(tMin, tMax),
      precipProbMaxPct: clampPct(dailyProbs[idx] ?? 0),
      precipSumMm: Math.max(0, round1(dailySums[idx] ?? 0)),
      uvIndexMax:
        typeof dailyUvs[idx] === 'number' && Number.isFinite(dailyUvs[idx])
          ? Math.max(0, round1(dailyUvs[idx]))
          : undefined,
      conditionCode: mapped.conditionCode,
      conditionTextVi: mapped.conditionTextVi,
      sunriseTimeVi: extractHm(dailySunrises[idx]),
      sunsetTimeVi: extractHm(dailySunsets[idx]),
    };
  });

  const snapshot: WeatherSnapshot = {
    provider: 'open_meteo',
    locationName,
    latitude: lat,
    longitude: lon,
    updatedAtIso,
    temperatureC,
    feelsLikeC,
    humidityPct,
    dewPointC,
    surfacePressureHpa,
    visibilityKm,
    windSpeedKmh,
    windGustKmh,
    uvIndex,
    precipMmPerHr,
    precipProbPct,
    conditionText: conditionTextVi,
    isDay,
    sunriseTimeVi: daily[0]?.sunriseTimeVi ?? solarCycle.sunriseTimeVi,
    sunsetTimeVi: daily[0]?.sunsetTimeVi ?? solarCycle.sunsetTimeVi,
    moonPhaseVi: solarCycle.moonPhaseVi,
    hourly,
    ...(daily.length > 0 ? { daily } : {}),
  };

  if (typeof data.utc_offset_seconds === 'number' && Number.isFinite(data.utc_offset_seconds)) {
    snapshot.utcOffsetSeconds = data.utc_offset_seconds;
  }

  if (typeof aqiDetails.aqi === 'number') {
    snapshot.aqi = aqiDetails.aqi;
  }
  if (typeof aqiDetails.pm25 === 'number') {
    snapshot.pm25 = aqiDetails.pm25;
  }
  if (typeof aqiDetails.pm10 === 'number') {
    snapshot.pm10 = aqiDetails.pm10;
  }

  return snapshot;
}
