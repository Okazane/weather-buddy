import type { HourlyForecastPoint, WeatherSnapshot } from './types';
import { inferAstronomicalDaytime, parseIsoOffsetSeconds } from './solarTime';

const TOMORROW_FORECAST_URL = 'https://api.tomorrow.io/v4/weather/forecast';

interface TomorrowValues {
  temperature?: number;
  temperatureApparent?: number;
  humidity?: number;
  windSpeed?: number;
  windGust?: number;
  uvIndex?: number;
  precipitationIntensity?: number;
  precipitationProbability?: number;
  weatherCode?: number;
}

interface TomorrowTimelineItem {
  time?: string;
  values?: TomorrowValues;
}

interface TomorrowForecastResponse {
  timelines?: {
    minutely?: TomorrowTimelineItem[];
    hourly?: TomorrowTimelineItem[];
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
    timesteps: '1m,1h',
    units: 'metric',
    apikey: apiKey,
  });
  return `${TOMORROW_FORECAST_URL}?${params.toString()}`;
}

export function mapTomorrowIoResponse(
  data: TomorrowForecastResponse,
  lat: number,
  lon: number,
  locationName: string
): WeatherSnapshot {
  const minutely = data.timelines?.minutely ?? [];
  const hourlyItems = data.timelines?.hourly ?? [];

  const currentItem = minutely[0] ?? hourlyItems[0] ?? {};
  const values = currentItem.values ?? {};
  const hourlyZero = hourlyItems[0]?.values ?? {};

  const updatedAtIso = currentItem.time ?? new Date().toISOString();
  const explicitOffsetSec = parseIsoOffsetSeconds(updatedAtIso);
  const isDay = inferAstronomicalDaytime(updatedAtIso, lat, lon, explicitOffsetSec);

  const temperatureC = round1(values.temperature ?? hourlyZero.temperature ?? 26);
  const feelsLikeC = round1(
    values.temperatureApparent ?? hourlyZero.temperatureApparent ?? temperatureC
  );
  const humidityPct = clampPct(values.humidity ?? hourlyZero.humidity ?? 70);
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

  const snapshot: WeatherSnapshot = {
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
    conditionText: conditionTextVi,
    isDay,
    hourly,
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
