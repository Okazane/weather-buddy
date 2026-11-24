import type { HourlyForecastPoint, WeatherSnapshot } from './types';
import { inferAstronomicalDaytime, parseIsoOffsetSeconds } from './solarTime';

const GOOGLE_CURRENT_URL = 'https://weather.googleapis.com/v1/currentConditions:lookup';
const GOOGLE_HOURLY_URL = 'https://weather.googleapis.com/v1/forecast/hours:lookup';

interface GoogleTemperatureValue {
  degrees?: number;
  unit?: string;
}

interface GoogleSpeedValue {
  value?: number;
  unit?: string;
}

interface GoogleWeatherCondition {
  type?: string;
  iconBaseUri?: string;
  description?: {
    text?: string;
    languageCode?: string;
  };
}

interface GooglePrecipitation {
  type?: string;
  probability?: {
    percent?: number;
  };
  qpf?: {
    quantity?: number;
    unit?: string;
  };
}

interface GoogleCurrentResponse {
  currentTime?: string;
  timeZone?: {
    id?: string;
  };
  isDaytime?: boolean;
  weatherCondition?: GoogleWeatherCondition;
  temperature?: GoogleTemperatureValue;
  feelsLikeTemperature?: GoogleTemperatureValue;
  relativeHumidity?: number;
  uvIndex?: number;
  wind?: {
    speed?: GoogleSpeedValue | number;
    gust?: GoogleSpeedValue | number;
  };
  precipitation?: GooglePrecipitation;
}

function resolveGoogleOffsetSeconds(
  isoTime: string,
  timeZoneId?: string
): number | undefined {
  const explicitOffset = parseIsoOffsetSeconds(isoTime);
  if (explicitOffset !== undefined) {
    return explicitOffset;
  }
  const trimmedTz = timeZoneId?.trim();
  if (trimmedTz) {
    try {
      const parsedMs = Date.parse(isoTime);
      const refMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: trimmedTz,
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
      // Ignore invalid IANA timezone ID
    }
  }
  return undefined;
}

interface GoogleForecastHourItem {
  interval?: {
    startTime?: string;
    endTime?: string;
  };
  isDaytime?: boolean;
  weatherCondition?: GoogleWeatherCondition;
  temperature?: GoogleTemperatureValue;
  relativeHumidity?: number;
  precipitation?: GooglePrecipitation;
}

interface GoogleHourlyResponse {
  forecastHours?: GoogleForecastHourItem[];
}

const GOOGLE_CONDITION_VI_FALLBACK: Record<string, string> = {
  CLEAR: 'Trời quang đãng',
  MOSTLY_CLEAR: 'Trời ít mây',
  PARTLY_CLOUDY: 'Có mây rải rác',
  MOSTLY_CLOUDY: 'Trời nhiều mây',
  CLOUDY: 'Trời âm u nhiều mây',
  WINDY: 'Trời nhiều gió',
  FOG: 'Có sương mù',
  HAZE: 'Sương mù nhẹ',
  LIGHT_RAIN: 'Mưa nhỏ',
  RAIN: 'Có mưa',
  RAIN_SHOWERS: 'Mưa rào rải rác',
  SCATTERED_SHOWERS: 'Mưa rào nhẹ',
  HEAVY_RAIN: 'Mưa to',
  THUNDERSTORM: 'Mưa dông',
  HEAVY_THUNDERSTORM: 'Mưa bão kèm sấm sét',
  SNOW: 'Có tuyết rơi',
};

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

function toCelsius(temp?: GoogleTemperatureValue, fallback = 25): number {
  const raw = temp?.degrees;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  if (temp?.unit === 'FAHRENHEIT') {
    return round1(((raw - 32) * 5) / 9);
  }
  return round1(raw);
}

function toKmh(speed?: GoogleSpeedValue | number): number {
  if (typeof speed === 'number' && Number.isFinite(speed)) {
    return round1(speed);
  }
  if (!speed || typeof speed !== 'object') {
    return 0;
  }
  const val = speed.value;
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return 0;
  }
  if (speed.unit === 'METERS_PER_SECOND') {
    return round1(val * 3.6);
  }
  if (speed.unit === 'MILES_PER_HOUR') {
    return round1(val * 1.60934);
  }
  return round1(val);
}

function resolveConditionText(cond?: GoogleWeatherCondition, isDay = true): string {
  const text = cond?.description?.text?.trim();
  if (text) {
    return text;
  }
  const typeKey = (cond?.type ?? '').toUpperCase();
  if (typeKey && GOOGLE_CONDITION_VI_FALLBACK[typeKey]) {
    return GOOGLE_CONDITION_VI_FALLBACK[typeKey];
  }
  return isDay ? 'Thời tiết ổn định' : 'Đêm dịu mát';
}

export function buildGoogleWeatherUrls(
  lat: number,
  lon: number,
  apiKey: string
): { currentUrl: string; hourlyUrl: string } {
  const baseParams = {
    key: apiKey.trim(),
    'location.latitude': String(lat),
    'location.longitude': String(lon),
    unitsSystem: 'METRIC',
    languageCode: 'vi',
  };

  const currentParams = new URLSearchParams(baseParams);
  const hourlyParams = new URLSearchParams({
    ...baseParams,
    hours: '24',
    pageSize: '24',
  });

  return {
    currentUrl: `${GOOGLE_CURRENT_URL}?${currentParams.toString()}`,
    hourlyUrl: `${GOOGLE_HOURLY_URL}?${hourlyParams.toString()}`,
  };
}

export function mapGoogleWeatherResponses(
  currentRaw: unknown,
  hourlyRaw: unknown,
  meta: { latitude: number; longitude: number; locationName: string; aqi?: number }
): WeatherSnapshot {
  const current = (currentRaw ?? {}) as GoogleCurrentResponse;
  const hourlyResp = (hourlyRaw ?? {}) as GoogleHourlyResponse;

  const updatedAtIso = current.currentTime || new Date().toISOString();
  const utcOffsetSeconds = resolveGoogleOffsetSeconds(
    updatedAtIso,
    current.timeZone?.id
  );
  // Google Weather v1 uses Proto3 JSON, which omits `isDaytime` when `false` (nighttime)
  const isDay =
    typeof current.isDaytime === 'boolean'
      ? current.isDaytime
      : inferAstronomicalDaytime(
          updatedAtIso,
          meta.latitude,
          meta.longitude,
          utcOffsetSeconds
        );
  const temperatureC = toCelsius(current.temperature, 25);
  const feelsLikeC = toCelsius(current.feelsLikeTemperature, temperatureC);
  const humidityPct = clampPct(current.relativeHumidity ?? 65);
  const uvIndex =
    typeof current.uvIndex === 'number' && Number.isFinite(current.uvIndex)
      ? Math.max(0, round1(current.uvIndex))
      : 0;
  const windSpeedKmh = toKmh(current.wind?.speed);
  const windGustKmh = Math.max(windSpeedKmh, toKmh(current.wind?.gust));
  const precipProbPct = clampPct(current.precipitation?.probability?.percent ?? 0);
  const precipMmPerHr =
    typeof current.precipitation?.qpf?.quantity === 'number' &&
    Number.isFinite(current.precipitation.qpf.quantity)
      ? Math.max(0, round2(current.precipitation.qpf.quantity))
      : 0;
  const conditionText = resolveConditionText(current.weatherCondition, isDay);

  const currentMs = Date.parse(updatedAtIso);
  const rawHours = Array.isArray(hourlyResp.forecastHours) ? hourlyResp.forecastHours : [];

  const upcomingHours = rawHours.filter((item) => {
    const startIso = item?.interval?.startTime;
    if (!startIso || !Number.isFinite(currentMs)) return true;
    const startMs = Date.parse(startIso);
    if (!Number.isFinite(startMs)) return true;
    // Keep hours starting after current observation (or within the future window)
    return startMs > currentMs - 5 * 60 * 1000;
  });

  const sourceHours = upcomingHours.length > 0 ? upcomingHours : rawHours;

  const hourly: HourlyForecastPoint[] = sourceHours.slice(0, 24).map((h, index) => {
    const fallbackIso = new Date(
      (Number.isFinite(currentMs) ? currentMs : Date.now()) + (index + 1) * 3600_000
    ).toISOString();
    return {
      timeIso: h.interval?.startTime || fallbackIso,
      temperatureC: toCelsius(h.temperature, temperatureC),
      humidityPct: clampPct(h.relativeHumidity ?? humidityPct),
      precipProbPct: clampPct(h.precipitation?.probability?.percent ?? 0),
      precipMm:
        typeof h.precipitation?.qpf?.quantity === 'number' &&
        Number.isFinite(h.precipitation.qpf.quantity)
          ? Math.max(0, round2(h.precipitation.qpf.quantity))
          : 0,
      conditionCode: String(h.weatherCondition?.type ?? 'CLEAR'),
    };
  });

  const snapshot: WeatherSnapshot = {
    provider: 'google',
    locationName: meta.locationName,
    latitude: meta.latitude,
    longitude: meta.longitude,
    updatedAtIso,
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

  if (typeof utcOffsetSeconds === 'number') {
    snapshot.utcOffsetSeconds = utcOffsetSeconds;
  }

  if (typeof meta.aqi === 'number' && Number.isFinite(meta.aqi)) {
    snapshot.aqi = Math.round(meta.aqi);
  }

  return snapshot;
}

export async function fetchGoogleWeather(
  lat: number,
  lon: number,
  locationName: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<WeatherSnapshot> {
  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    throw new Error('Google Weather API key is required.');
  }

  const { currentUrl, hourlyUrl } = buildGoogleWeatherUrls(lat, lon, trimmedKey);

  const [currentRes, hourlyRes] = await Promise.all([
    fetchImpl(currentUrl),
    fetchImpl(hourlyUrl),
  ]);

  if (!currentRes.ok) {
    const errText = await currentRes.text().catch(() => '');
    throw new Error(
      `Google Weather currentConditions failed (HTTP ${currentRes.status}): ${errText.slice(0, 200)}`
    );
  }

  if (!hourlyRes.ok) {
    const errText = await hourlyRes.text().catch(() => '');
    throw new Error(
      `Google Weather forecast/hours failed (HTTP ${hourlyRes.status}): ${errText.slice(0, 200)}`
    );
  }

  const [currentJson, hourlyJson] = await Promise.all([
    currentRes.json(),
    hourlyRes.json(),
  ]);

  return mapGoogleWeatherResponses(currentJson, hourlyJson, {
    latitude: lat,
    longitude: lon,
    locationName,
  });
}
