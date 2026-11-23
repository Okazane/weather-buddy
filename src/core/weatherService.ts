import { fetchGoogleWeather } from './googleWeatherClient';
import { fetchOpenMeteoAqi, fetchOpenMeteoWeather } from './openMeteoClient';
import { fetchTomorrowIoWeather } from './tomorrowIoClient';
import { fetchWeatherApiWeather } from './weatherApiClient';
import type {
  HourlyForecastPoint,
  WeatherProviderType,
  WeatherSnapshot,
} from './types';

function makeHourlySeries(
  baseIso: string,
  specs: Array<{
    tempC: number;
    precipProbPct?: number;
    precipMm?: number;
    conditionCode?: string;
  }>
): HourlyForecastPoint[] {
  const baseMs = Date.parse(baseIso);
  return specs.map((spec, idx) => ({
    timeIso: new Date(baseMs + (idx + 1) * 3600_000).toISOString(),
    temperatureC: spec.tempC,
    precipProbPct: spec.precipProbPct ?? 5,
    precipMm: spec.precipMm ?? 0,
    conditionCode: spec.conditionCode ?? 'CLEAR',
  }));
}

const DEMO_BASE_MORNING = '2026-05-15T02:00:00.000Z'; // 09:00 ICT (+07:00)
const DEMO_BASE_NOON = '2026-05-15T05:00:00.000Z'; // 12:00 ICT (+07:00)

export const DEMO_WEATHER_PRESETS: Record<string, WeatherSnapshot> = {
  sunny: {
    provider: 'demo',
    locationName: 'Đà Nẵng',
    latitude: 16.0544,
    longitude: 108.2022,
    updatedAtIso: DEMO_BASE_MORNING,
    temperatureC: 27,
    feelsLikeC: 28,
    humidityPct: 64,
    windSpeedKmh: 12,
    windGustKmh: 18,
    uvIndex: 6,
    precipMmPerHr: 0,
    precipProbPct: 10,
    conditionText: 'Trời nắng đẹp dịu nhẹ',
    isDay: true,
    aqi: 42,
    hourly: makeHourlySeries(DEMO_BASE_MORNING, [
      { tempC: 28, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 29, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 30, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 30, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 29, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 28, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 27, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 26, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 25, precipProbPct: 5, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 25, precipProbPct: 5, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 24, precipProbPct: 5, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 24, precipProbPct: 5, precipMm: 0, conditionCode: 'CLEAR' },
    ]),
  },

  hot_uv: {
    provider: 'demo',
    locationName: 'TP. Hồ Chí Minh',
    latitude: 10.8231,
    longitude: 106.6297,
    updatedAtIso: DEMO_BASE_NOON,
    temperatureC: 35.5,
    feelsLikeC: 38.5,
    humidityPct: 58,
    windSpeedKmh: 9,
    windGustKmh: 15,
    uvIndex: 10,
    precipMmPerHr: 0,
    precipProbPct: 12,
    conditionText: 'Nắng gắt, chỉ số tia UV rất cao',
    isDay: true,
    aqi: 68,
    hourly: makeHourlySeries(DEMO_BASE_NOON, [
      { tempC: 36, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 36, precipProbPct: 15, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 35, precipProbPct: 20, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 34, precipProbPct: 25, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 32, precipProbPct: 20, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 30, precipProbPct: 15, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 29, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 29, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 28, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 28, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 27, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 27, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
    ]),
  },

  light_rain: {
    provider: 'demo',
    locationName: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
    updatedAtIso: DEMO_BASE_MORNING,
    temperatureC: 23.5,
    feelsLikeC: 24,
    humidityPct: 88,
    windSpeedKmh: 11,
    windGustKmh: 19,
    uvIndex: 2,
    precipMmPerHr: 1.4,
    precipProbPct: 78,
    conditionText: 'Mưa nhỏ rải rác',
    isDay: true,
    aqi: 38,
    hourly: makeHourlySeries(DEMO_BASE_MORNING, [
      { tempC: 23, precipProbPct: 75, precipMm: 1.2, conditionCode: 'LIGHT_RAIN' },
      { tempC: 23, precipProbPct: 68, precipMm: 0.9, conditionCode: 'LIGHT_RAIN' },
      { tempC: 24, precipProbPct: 55, precipMm: 0.4, conditionCode: 'DRIZZLE' },
      { tempC: 24, precipProbPct: 35, precipMm: 0.1, conditionCode: 'CLOUDY' },
      { tempC: 25, precipProbPct: 25, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 25, precipProbPct: 20, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 25, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 24, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 23, precipProbPct: 15, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 23, precipProbPct: 20, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 20, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 20, precipMm: 0, conditionCode: 'CLOUDY' },
    ]),
  },

  heavy_storm: {
    provider: 'demo',
    locationName: 'Đà Nẵng',
    latitude: 16.0544,
    longitude: 108.2022,
    updatedAtIso: DEMO_BASE_NOON,
    temperatureC: 23,
    feelsLikeC: 22,
    humidityPct: 95,
    windSpeedKmh: 30,
    windGustKmh: 48,
    uvIndex: 1,
    precipMmPerHr: 9.2,
    precipProbPct: 96,
    conditionText: 'Mưa bão lớn kèm gió giật mạnh',
    isDay: true,
    aqi: 28,
    hourly: makeHourlySeries(DEMO_BASE_NOON, [
      { tempC: 23, precipProbPct: 95, precipMm: 8.8, conditionCode: 'THUNDERSTORM' },
      { tempC: 22, precipProbPct: 92, precipMm: 7.5, conditionCode: 'THUNDERSTORM' },
      { tempC: 22, precipProbPct: 88, precipMm: 5.6, conditionCode: 'HEAVY_RAIN' },
      { tempC: 22, precipProbPct: 80, precipMm: 3.8, conditionCode: 'RAIN' },
      { tempC: 23, precipProbPct: 65, precipMm: 1.9, conditionCode: 'LIGHT_RAIN' },
      { tempC: 23, precipProbPct: 50, precipMm: 0.8, conditionCode: 'LIGHT_RAIN' },
      { tempC: 23, precipProbPct: 40, precipMm: 0.3, conditionCode: 'CLOUDY' },
      { tempC: 23, precipProbPct: 35, precipMm: 0.1, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 30, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 25, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 25, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 20, precipMm: 0, conditionCode: 'CLOUDY' },
    ]),
  },

  sunny_rain_ahead: {
    provider: 'demo',
    locationName: 'TP. Hồ Chí Minh',
    latitude: 10.8231,
    longitude: 106.6297,
    updatedAtIso: DEMO_BASE_MORNING,
    temperatureC: 28.5,
    feelsLikeC: 29.5,
    humidityPct: 68,
    windSpeedKmh: 10,
    windGustKmh: 17,
    uvIndex: 6,
    precipMmPerHr: 0,
    precipProbPct: 15,
    conditionText: 'Nắng đẹp buổi sáng, chiều có mưa rào',
    isDay: true,
    aqi: 52,
    hourly: makeHourlySeries(DEMO_BASE_MORNING, [
      { tempC: 29, precipProbPct: 18, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 30, precipProbPct: 35, precipMm: 0.1, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 28, precipProbPct: 85, precipMm: 3.6, conditionCode: 'RAIN' },
      { tempC: 26, precipProbPct: 88, precipMm: 4.8, conditionCode: 'HEAVY_RAIN' },
      { tempC: 26, precipProbPct: 72, precipMm: 2.1, conditionCode: 'LIGHT_RAIN' },
      { tempC: 26, precipProbPct: 40, precipMm: 0.3, conditionCode: 'CLOUDY' },
      { tempC: 26, precipProbPct: 20, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 25, precipProbPct: 15, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 25, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 25, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 24, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      { tempC: 24, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
    ]),
  },

  chilly_dalat: {
    provider: 'demo',
    locationName: 'Đà Lạt',
    latitude: 11.9404,
    longitude: 108.4583,
    updatedAtIso: DEMO_BASE_MORNING,
    temperatureC: 18.5,
    feelsLikeC: 18,
    humidityPct: 78,
    windSpeedKmh: 12,
    windGustKmh: 20,
    uvIndex: 3,
    precipMmPerHr: 0,
    precipProbPct: 15,
    conditionText: 'Se lạnh dễ chịu, sương mù nhẹ',
    isDay: true,
    aqi: 26,
    hourly: makeHourlySeries(DEMO_BASE_MORNING, [
      { tempC: 19, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 20, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 21, precipProbPct: 20, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 21, precipProbPct: 20, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 20, precipProbPct: 20, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 18, precipProbPct: 15, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 17, precipProbPct: 15, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 16, precipProbPct: 10, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 16, precipProbPct: 10, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 15, precipProbPct: 10, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 15, precipProbPct: 10, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 14, precipProbPct: 10, precipMm: 0, conditionCode: 'FOG' },
    ]),
  },

  freezing_sapa: {
    provider: 'demo',
    locationName: 'Sa Pa',
    latitude: 22.3364,
    longitude: 103.8438,
    updatedAtIso: DEMO_BASE_MORNING,
    temperatureC: 9.5,
    feelsLikeC: 7.5,
    humidityPct: 86,
    windSpeedKmh: 16,
    windGustKmh: 26,
    uvIndex: 2,
    precipMmPerHr: 0,
    precipProbPct: 20,
    conditionText: 'Rét đậm vùng cao, mây mù bao phủ',
    isDay: true,
    aqi: 24,
    hourly: makeHourlySeries(DEMO_BASE_MORNING, [
      { tempC: 10, precipProbPct: 20, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 11, precipProbPct: 20, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 12, precipProbPct: 15, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 12, precipProbPct: 15, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 11, precipProbPct: 20, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 9, precipProbPct: 20, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 8, precipProbPct: 20, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 8, precipProbPct: 15, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 7, precipProbPct: 15, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 7, precipProbPct: 15, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 6, precipProbPct: 15, precipMm: 0, conditionCode: 'FOG' },
      { tempC: 6, precipProbPct: 15, precipMm: 0, conditionCode: 'FOG' },
    ]),
  },

  high_aqi_hanoi: {
    provider: 'demo',
    locationName: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
    updatedAtIso: DEMO_BASE_MORNING,
    temperatureC: 24.5,
    feelsLikeC: 25,
    humidityPct: 72,
    windSpeedKmh: 6,
    windGustKmh: 10,
    uvIndex: 4,
    precipMmPerHr: 0,
    precipProbPct: 10,
    conditionText: 'Nhiều mây mù, chất lượng không khí kém',
    isDay: true,
    aqi: 168,
    hourly: makeHourlySeries(DEMO_BASE_MORNING, [
      { tempC: 25, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 26, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 27, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 27, precipProbPct: 15, precipMm: 0, conditionCode: 'PARTLY_CLOUDY' },
      { tempC: 26, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 25, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 24, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 23, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 23, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 22, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      { tempC: 21, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
    ]),
  },
};

export interface DemoScenarioMeta {
  id: keyof typeof DEMO_WEATHER_PRESETS;
  labelVi: string;
  emoji: string;
}

export const DEMO_SCENARIO_LIST: DemoScenarioMeta[] = [
  { id: 'sunny', labelVi: 'Nắng đẹp', emoji: '🌤️' },
  { id: 'hot_uv', labelVi: 'Nắng gắt UV', emoji: '🕶️' },
  { id: 'light_rain', labelVi: 'Mưa nhỏ cầm ô', emoji: '☔' },
  { id: 'heavy_storm', labelVi: 'Mưa bão áo mưa', emoji: '⛈️' },
  { id: 'sunny_rain_ahead', labelVi: 'Nắng nhưng chiều mưa', emoji: '🎒' },
  { id: 'chilly_dalat', labelVi: 'Đà Lạt se lạnh', emoji: '🍂' },
  { id: 'freezing_sapa', labelVi: 'Sa Pa rét đậm', emoji: '🧣' },
  { id: 'high_aqi_hanoi', labelVi: 'Hà Nội bụi mịn', emoji: '😷' },
];

async function enrichWithOpenMeteoAqi(
  snapshot: WeatherSnapshot,
  lat: number,
  lon: number,
  fetchImpl: typeof fetch
): Promise<WeatherSnapshot> {
  if (typeof snapshot.aqi === 'number') {
    return snapshot;
  }
  const aqi = await fetchOpenMeteoAqi(lat, lon, fetchImpl);
  if (typeof aqi === 'number') {
    snapshot.aqi = aqi;
  }
  return snapshot;
}

export async function fetchWeatherSnapshot(params: {
  latitude: number;
  longitude: number;
  locationName: string;
  provider?: WeatherProviderType;
  tomorrowIoApiKey?: string;
  weatherApiKey?: string;
  googleApiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<WeatherSnapshot> {
  const {
    latitude,
    longitude,
    locationName,
    provider = 'auto',
    tomorrowIoApiKey,
    weatherApiKey,
    googleApiKey,
    fetchImpl = fetch,
  } = params;

  const trimmedTomorrow = tomorrowIoApiKey?.trim() ?? '';
  const trimmedWeatherApi = weatherApiKey?.trim() ?? '';
  const trimmedGoogle = googleApiKey?.trim() ?? '';

  if (provider === 'open_meteo') {
    return fetchOpenMeteoWeather(latitude, longitude, locationName, fetchImpl);
  }

  if (provider === 'tomorrow_io') {
    if (!trimmedTomorrow) {
      throw new Error(
        'Vui lòng nhập Tomorrow.io API Key (miễn phí, không cần thẻ) hoặc chuyển sang Tự động.'
      );
    }
    const [snap, aqi] = await Promise.all([
      fetchTomorrowIoWeather(latitude, longitude, locationName, trimmedTomorrow, fetchImpl),
      fetchOpenMeteoAqi(latitude, longitude, fetchImpl),
    ]);
    if (snap.aqi === undefined && typeof aqi === 'number') {
      snap.aqi = aqi;
    }
    return snap;
  }

  if (provider === 'weatherapi') {
    if (!trimmedWeatherApi) {
      throw new Error(
        'Vui lòng nhập WeatherAPI.com Key (miễn phí 100k lượt/tháng, không cần thẻ) hoặc chuyển sang Tự động.'
      );
    }
    const snap = await fetchWeatherApiWeather(
      latitude,
      longitude,
      locationName,
      trimmedWeatherApi,
      fetchImpl
    );
    return enrichWithOpenMeteoAqi(snap, latitude, longitude, fetchImpl);
  }

  if (provider === 'google') {
    if (!trimmedGoogle) {
      throw new Error(
        'Vui lòng nhập Google Cloud Weather API Key để sử dụng nguồn Google Weather.'
      );
    }
    const [googleSnap, aqi] = await Promise.all([
      fetchGoogleWeather(latitude, longitude, locationName, trimmedGoogle, fetchImpl),
      fetchOpenMeteoAqi(latitude, longitude, fetchImpl),
    ]);
    if (googleSnap.aqi === undefined && typeof aqi === 'number') {
      googleSnap.aqi = aqi;
    }
    return googleSnap;
  }

  // provider === 'auto': Prefer no-card high-accuracy keys first (Tomorrow.io -> WeatherAPI),
  // then Google WeatherNext if configured, and always fall back cleanly to Open-Meteo Free.
  if (trimmedTomorrow.length > 0) {
    try {
      const [snap, aqi] = await Promise.all([
        fetchTomorrowIoWeather(latitude, longitude, locationName, trimmedTomorrow, fetchImpl),
        fetchOpenMeteoAqi(latitude, longitude, fetchImpl),
      ]);
      if (snap.aqi === undefined && typeof aqi === 'number') {
        snap.aqi = aqi;
      }
      return snap;
    } catch {
      // Fall through to next available provider
    }
  }

  if (trimmedWeatherApi.length > 0) {
    try {
      const snap = await fetchWeatherApiWeather(
        latitude,
        longitude,
        locationName,
        trimmedWeatherApi,
        fetchImpl
      );
      return enrichWithOpenMeteoAqi(snap, latitude, longitude, fetchImpl);
    } catch {
      // Fall through to next available provider
    }
  }

  if (trimmedGoogle.length > 0) {
    try {
      const [googleSnap, aqi] = await Promise.all([
        fetchGoogleWeather(latitude, longitude, locationName, trimmedGoogle, fetchImpl),
        fetchOpenMeteoAqi(latitude, longitude, fetchImpl),
      ]);
      if (googleSnap.aqi === undefined && typeof aqi === 'number') {
        googleSnap.aqi = aqi;
      }
      return googleSnap;
    } catch {
      // Fall through to Open-Meteo Free
    }
  }

  return fetchOpenMeteoWeather(latitude, longitude, locationName, fetchImpl);
}
