import type { DailyForecastPoint, HourlyForecastPoint, WeatherSnapshot } from './types';
import { computeDewPointC, computeSolarAndMoonCycle, inferAstronomicalDaytime, parseIsoOffsetSeconds } from './solarTime';

const TOMORROW_FORECAST_URL = 'https://api.tomorrow.io/v4/weather/forecast';

interface TomorrowValues {
  temperature?: number;
  temperatureMax?: number;
  temperatureMin?: number;
  temperatureApparent?: number;
  humidity?: number;
  dewPoint?: number;
  pressureSurfaceLevel?: number;
  visibility?: number;
  windSpeed?: number;
  windGust?: number;
  uvIndex?: number;
  uvIndexMax?: number;
  precipitationIntensity?: number;
  precipitationIntensityAvg?: number;
  rainAccumulationSum?: number;
  precipitationProbability?: number;
  precipitationProbabilityMax?: number;
  weatherCode?: number;
  weatherCodeMax?: number;
  sunriseTime?: string;
  sunsetTime?: string;
}

interface TomorrowTimelineItem {
  time?: string;
  values?: TomorrowValues;
}

interface TomorrowForecastResponse {
  timelines?: {
    minutely?: TomorrowTimelineItem[];
    hourly?: TomorrowTimelineItem[];
    daily?: TomorrowTimelineItem[];
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

function msToKmh(valMs: number | undefined): number {
  if (typeof valMs !== 'number' || !Number.isFinite(valMs)) return 0;
  return Math.max(0, round1(valMs * 3.6));
}

export function mapTomorrowWeatherCode(
  code: number | undefined,
  isDay: boolean
): { conditionCode: string; conditionTextVi: string } {
  switch (code) {
    case 1000:
      return {
        conditionCode: 'CLEAR',
        conditionTextVi: isDay ? 'Trời nắng quang đãng' : 'Đêm quang đãng',
      };
    case 1100:
      return {
        conditionCode: 'MOSTLY_CLEAR',
        conditionTextVi: isDay ? 'Nắng nhẹ dễ chịu' : 'Đêm ít mây',
      };
    case 1101:
      return {
        conditionCode: 'PARTLY_CLOUDY',
        conditionTextVi: 'Có mây rải rác',
      };
    case 1102:
      return {
        conditionCode: 'MOSTLY_CLOUDY',
        conditionTextVi: isDay ? 'Nắng dịu có mây' : 'Đêm có mây nhẹ',
      };
    case 1001:
      return {
        conditionCode: 'CLOUDY',
        conditionTextVi: 'Trời nhiều mây',
      };
    case 2000:
    case 2100:
      return {
        conditionCode: 'FOG',
        conditionTextVi: 'Có sương mù nhẹ',
      };
    case 4000:
      return {
        conditionCode: 'DRIZZLE',
        conditionTextVi: 'Mưa phùn lất phất',
      };
    case 4200:
      return {
        conditionCode: 'LIGHT_RAIN',
        conditionTextVi: 'Mưa nhỏ rải rác',
      };
    case 4001:
      return {
        conditionCode: 'RAIN',
        conditionTextVi: 'Mưa rào vừa',
      };
    case 4201:
      return {
        conditionCode: 'HEAVY_RAIN',
        conditionTextVi: 'Mưa to nặng hạt',
      };
    case 5000:
    case 5001:
    case 5100:
    case 5101:
    case 6000:
    case 6001:
    case 6200:
    case 6201:
    case 7000:
    case 7101:
    case 7102:
      return {
        conditionCode: 'SNOW',
        conditionTextVi: 'Trời rét buốt',
      };
    case 8000:
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

export function buildTomorrowIoUrl(lat: number, lon: number, apiKey: string): string {
  const params = new URLSearchParams({
    location: `${lat},${lon}`,
    timesteps: '1m,1h,1d',
    units: 'metric',
    apikey: apiKey,
  });
  return `${TOMORROW_FORECAST_URL}?${params.toString()}`;
}

function extractClockFromIso(iso: string | undefined, offsetSeconds: number): string | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  const shifted = new Date(ms + offsetSeconds * 1000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function extractDateFromIso(iso: string | undefined, offsetSeconds: number): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const direct = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct && !/Z$/i.test(iso)) return direct[1];
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  const shifted = new Date(ms + offsetSeconds * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function mapTomorrowIoResponse(
  data: TomorrowForecastResponse,
  lat: number,
  lon: number,
  locationName: string
): WeatherSnapshot {
  const minutely = data.timelines?.minutely ?? [];
  const hourlyItems = data.timelines?.hourly ?? [];
  const dailyItems = data.timelines?.daily ?? [];

  const currentItem = minutely[0] ?? hourlyItems[0] ?? {};
  const values = currentItem.values ?? {};
  const hourlyZero = hourlyItems[0]?.values ?? {};

  const updatedAtIso = currentItem.time ?? new Date().toISOString();
  const explicitOffsetSec = parseIsoOffsetSeconds(updatedAtIso);
  const isVietnamCoords = lat >= 8 && lat <= 24 && lon >= 102 && lon <= 110.5;
  const effectiveOffsetSec =
    explicitOffsetSec ?? (isVietnamCoords ? 7 * 3600 : Math.round(lon / 15) * 3600);
  const isDay = inferAstronomicalDaytime(updatedAtIso, lat, lon, explicitOffsetSec);
  const solarCycle = computeSolarAndMoonCycle(updatedAtIso, lat, lon, explicitOffsetSec);

  const temperatureC = round1(values.temperature ?? hourlyZero.temperature ?? 26);
  const feelsLikeC = round1(
    values.temperatureApparent ?? hourlyZero.temperatureApparent ?? temperatureC
  );
  const humidityPct = clampPct(values.humidity ?? hourlyZero.humidity ?? 70);
  const rawDewPoint = values.dewPoint ?? hourlyZero.dewPoint;
  const dewPointC =
    typeof rawDewPoint === 'number' && Number.isFinite(rawDewPoint)
      ? round1(rawDewPoint)
      : computeDewPointC(temperatureC, humidityPct);
  const rawPressure = values.pressureSurfaceLevel ?? hourlyZero.pressureSurfaceLevel;
  const surfacePressureHpa =
    typeof rawPressure === 'number' && Number.isFinite(rawPressure)
      ? round1(rawPressure)
      : undefined;
  const rawVisibility = values.visibility ?? hourlyZero.visibility;
  const visibilityKm =
    typeof rawVisibility === 'number' && Number.isFinite(rawVisibility)
      ? round1(rawVisibility)
      : undefined;
  const windSpeedKmh = msToKmh(values.windSpeed ?? hourlyZero.windSpeed);
  const windGustKmh = Math.max(
    windSpeedKmh,
    msToKmh(values.windGust ?? hourlyZero.windGust)
  );
  const uvIndex = Math.max(0, round1(values.uvIndex ?? hourlyZero.uvIndex ?? 0));

  // Blend immediate minutely precipitation peak in the next 15m for higher sensitivity
  const next15MinPrecip = minutely
    .slice(0, 15)
    .reduce(
      (maxVal, item) => Math.max(maxVal, item.values?.precipitationIntensity ?? 0),
      0
    );
  const precipMmPerHr = Math.max(
    0,
    round2(
      Math.max(
        values.precipitationIntensity ?? hourlyZero.precipitationIntensity ?? 0,
        next15MinPrecip
      )
    )
  );
  const precipProbPct = clampPct(
    values.precipitationProbability ?? hourlyZero.precipitationProbability ?? 0
  );

  const weatherCode = values.weatherCode ?? hourlyZero.weatherCode;
  const { conditionTextVi } = mapTomorrowWeatherCode(weatherCode, isDay);

  const hourly: HourlyForecastPoint[] = hourlyItems.slice(1, 25).map((item) => {
    const hv = item.values ?? {};
    const timeIso = item.time ?? new Date().toISOString();
    const mapped = mapTomorrowWeatherCode(
      hv.weatherCode,
      inferAstronomicalDaytime(timeIso, lat, lon, explicitOffsetSec)
    );
    return {
      timeIso,
      temperatureC: round1(hv.temperature ?? temperatureC),
      humidityPct: clampPct(hv.humidity ?? humidityPct),
      precipProbPct: clampPct(hv.precipitationProbability ?? 0),
      precipMm: Math.max(0, round2(hv.precipitationIntensity ?? 0)),
      conditionCode: mapped.conditionCode,
    };
  });

  const daily: DailyForecastPoint[] = dailyItems.slice(0, 7).map((dItem) => {
    const dv = dItem.values ?? {};
    const dCode = dv.weatherCodeMax ?? dv.weatherCode;
    const mapped = mapTomorrowWeatherCode(dCode, true);
    const tMax = round1(dv.temperatureMax ?? dv.temperature ?? temperatureC + 2);
    const tMin = round1(dv.temperatureMin ?? dv.temperature ?? temperatureC - 3);
    const rainSum =
      typeof dv.rainAccumulationSum === 'number' && Number.isFinite(dv.rainAccumulationSum)
        ? Math.max(0, round1(dv.rainAccumulationSum))
        : typeof dv.precipitationIntensityAvg === 'number' &&
            Number.isFinite(dv.precipitationIntensityAvg)
          ? Math.max(0, round1(dv.precipitationIntensityAvg * 24))
          : 0;
    return {
      dateIso: extractDateFromIso(dItem.time, effectiveOffsetSec),
      tempMinC: Math.min(tMin, tMax),
      tempMaxC: Math.max(tMin, tMax),
      precipProbMaxPct: clampPct(dv.precipitationProbabilityMax ?? dv.precipitationProbability ?? 0),
      precipSumMm: rainSum,
      uvIndexMax:
        typeof dv.uvIndexMax === 'number' && Number.isFinite(dv.uvIndexMax)
          ? Math.max(0, round1(dv.uvIndexMax))
          : undefined,
      conditionCode: mapped.conditionCode,
      conditionTextVi: mapped.conditionTextVi,
      sunriseTimeVi: extractClockFromIso(dv.sunriseTime, effectiveOffsetSec),
      sunsetTimeVi: extractClockFromIso(dv.sunsetTime, effectiveOffsetSec),
    };
  });

  const snapshot: WeatherSnapshot = {
    provider: 'tomorrow_io',
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

  if (typeof explicitOffsetSec === 'number') {
    snapshot.utcOffsetSeconds = explicitOffsetSec;
  }

  return snapshot;
}

export async function fetchTomorrowIoWeather(
  lat: number,
  lon: number,
  locationName: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<WeatherSnapshot> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('Thiếu Tomorrow.io API Key.');
  }

  const res = await fetchImpl(buildTomorrowIoUrl(lat, lon, trimmed), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Tomorrow.io API failed (HTTP ${res.status}): ${errText.slice(0, 220)}`
    );
  }

  const data = (await res.json()) as TomorrowForecastResponse;
  return mapTomorrowIoResponse(data, lat, lon, locationName);
}
