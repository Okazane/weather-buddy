import { fetchGoogleWeather } from './googleWeatherClient';
import {
  fetchOpenMeteoAqiDetails,
  fetchOpenMeteoWeather,
} from './openMeteoClient';
import { computeDewPointC, computeSolarAndMoonCycle } from './solarTime';
import { fetchTomorrowIoWeather } from './tomorrowIoClient';
import { fetchWeatherApiWeather } from './weatherApiClient';
import { crossValidateWeatherSnapshot } from './weatherConsensus';
import type {
  DailyForecastPoint,
  HourlyForecastPoint,
  WeatherProviderType,
  WeatherSnapshot,
} from './types';

interface DemoHourlyAnchor {
  tempC: number;
  humidityPct: number;
  precipProbPct: number;
  precipMm: number;
  conditionCode?: string;
}

interface DemoHourlySeed {
  tempC: number;
  humidityPct?: number;
  precipProbPct?: number;
  precipMm?: number;
  conditionCode?: string;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function clampDemoHumidity(val: number): number {
  if (!Number.isFinite(val)) return 68;
  return Math.max(28, Math.min(98, Math.round(val)));
}

function computeWetnessSignal(
  precipProbPct: number,
  precipMm: number,
  conditionCode: string
): number {
  const probBoost = Math.max(0, precipProbPct) * 0.16;
  const mmBoost = Math.min(9, Math.sqrt(Math.max(0, precipMm)) * 3.6);
  const codeUpper = conditionCode.toUpperCase();
  const skyBoost =
    codeUpper === 'FOG'
      ? 5
      : codeUpper === 'CLOUDY' || codeUpper === 'MOSTLY_CLOUDY'
        ? 1.5
        : 0;
  return probBoost + mmBoost + skyBoost;
}

function makeHourlySeries(
  baseIso: string,
  anchor: DemoHourlyAnchor,
  specs: DemoHourlySeed[]
): HourlyForecastPoint[] {
  const baseMs = Date.parse(baseIso);
  const anchorWetness = computeWetnessSignal(
    anchor.precipProbPct,
    anchor.precipMm,
    anchor.conditionCode ?? 'PARTLY_CLOUDY'
  );

  const fullSpecs: DemoHourlySeed[] = [...specs];
  if (fullSpecs.length > 0 && fullSpecs.length < 24) {
    const seedCount = fullSpecs.length;
    const remaining = 24 - seedCount;
    const lastSeed = fullSpecs[seedCount - 1];
    const endTemp = lastSeed.tempC;
    const targetEndTemp = round1(anchor.tempC - 0.3);
    const troughTemp = round1(Math.min(endTemp, anchor.tempC) - 1.5);

    let troughStep = Math.max(1, Math.round(remaining * 0.55));
    for (let s = 1; s <= remaining; s += 1) {
      const slotMs = baseMs + (seedCount + s) * 3600_000;
      const vnHour = new Date(slotMs + 7 * 3600_000).getUTCHours();
      if (vnHour === 5) {
        troughStep = s;
        break;
      }
    }

    const lastProb = lastSeed.precipProbPct ?? 10;
    const settledProb = Math.min(20, Math.max(5, Math.round(anchor.precipProbPct * 0.8)));

    for (let s = 1; s <= remaining; s += 1) {
      const slotMs = baseMs + (seedCount + s) * 3600_000;
      const vnHour = new Date(slotMs + 7 * 3600_000).getUTCHours();

      let tempC: number;
      if (s <= troughStep) {
        const t = s / troughStep;
        tempC = round1(endTemp + (troughTemp - endTemp) * (0.5 - 0.5 * Math.cos(Math.PI * t)));
      } else {
        const denom = Math.max(1, remaining - troughStep);
        const t = (s - troughStep) / denom;
        tempC = round1(
          troughTemp + (targetEndTemp - troughTemp) * (0.5 - 0.5 * Math.cos(Math.PI * t))
        );
      }

      const progress = s / remaining;
      const precipProbPct = Math.round(lastProb + (settledProb - lastProb) * progress);
      let conditionCode = lastSeed.conditionCode ?? 'CLEAR';
      if (conditionCode === 'FOG' && vnHour >= 8 && vnHour <= 16) {
        conditionCode = 'PARTLY_CLOUDY';
      }

      fullSpecs.push({
        tempC,
        precipProbPct,
        precipMm: 0,
        conditionCode,
      });
    }
  }

  return fullSpecs.map((spec, idx) => {
    const precipProbPct = spec.precipProbPct ?? 5;
    const precipMm = spec.precipMm ?? 0;
    const conditionCode = spec.conditionCode ?? 'CLEAR';
    const slotWetness = computeWetnessSignal(precipProbPct, precipMm, conditionCode);
    const computedHumidity =
      spec.humidityPct ??
      anchor.humidityPct + (anchor.tempC - spec.tempC) * 2.65 + (slotWetness - anchorWetness);

    return {
      timeIso: new Date(baseMs + (idx + 1) * 3600_000).toISOString(),
      temperatureC: spec.tempC,
      humidityPct: clampDemoHumidity(computedHumidity),
      precipProbPct,
      precipMm,
      conditionCode,
    };
  });
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
    hourly: makeHourlySeries(
      DEMO_BASE_MORNING,
      { tempC: 27, humidityPct: 64, precipProbPct: 10, precipMm: 0, conditionCode: 'CLEAR' },
      [
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
      ]
    ),
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
    hourly: makeHourlySeries(
      DEMO_BASE_NOON,
      { tempC: 35.5, humidityPct: 58, precipProbPct: 12, precipMm: 0, conditionCode: 'CLEAR' },
      [
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
      ]
    ),
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
    hourly: makeHourlySeries(
      DEMO_BASE_MORNING,
      {
        tempC: 23.5,
        humidityPct: 88,
        precipProbPct: 78,
        precipMm: 1.4,
        conditionCode: 'LIGHT_RAIN',
      },
      [
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
      ]
    ),
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
    hourly: makeHourlySeries(
      DEMO_BASE_NOON,
      {
        tempC: 23,
        humidityPct: 95,
        precipProbPct: 96,
        precipMm: 9.2,
        conditionCode: 'THUNDERSTORM',
      },
      [
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
      ]
    ),
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
    hourly: makeHourlySeries(
      DEMO_BASE_MORNING,
      { tempC: 28.5, humidityPct: 68, precipProbPct: 15, precipMm: 0, conditionCode: 'CLEAR' },
      [
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
      ]
    ),
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
    hourly: makeHourlySeries(
      DEMO_BASE_MORNING,
      {
        tempC: 18.5,
        humidityPct: 78,
        precipProbPct: 15,
        precipMm: 0,
        conditionCode: 'PARTLY_CLOUDY',
      },
      [
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
      ]
    ),
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
    hourly: makeHourlySeries(
      DEMO_BASE_MORNING,
      { tempC: 9.5, humidityPct: 86, precipProbPct: 20, precipMm: 0, conditionCode: 'FOG' },
      [
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
      ]
    ),
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
    hourly: makeHourlySeries(
      DEMO_BASE_MORNING,
      { tempC: 24.5, humidityPct: 72, precipProbPct: 10, precipMm: 0, conditionCode: 'CLOUDY' },
      [
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
      ]
    ),
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

function synthesize7DayForecast(snap: WeatherSnapshot): DailyForecastPoint[] {
  const baseMs = Number.isFinite(Date.parse(snap.updatedAtIso))
    ? Date.parse(snap.updatedAtIso)
    : Date.now();
  const offsetSec =
    typeof snap.utcOffsetSeconds === 'number' && Number.isFinite(snap.utcOffsetSeconds)
      ? snap.utcOffsetSeconds
      : 7 * 3600;

  const hourlyTemps = [snap.temperatureC, ...(snap.hourly ?? []).map((h) => h.temperatureC)];
  const baseHi = Math.max(...hourlyTemps, snap.temperatureC + 2.2);
  const baseLo = Math.min(...hourlyTemps, snap.temperatureC - 2.6);
  const baseProb = Math.max(
    snap.precipProbPct,
    ...(snap.hourly ?? []).slice(0, 12).map((h) => h.precipProbPct)
  );
  const day0Sum = round1(
    (snap.hourly ?? []).slice(0, 24).reduce((acc, h) => acc + (h.precipMm || 0), 0)
  );

  const offsets: Array<[number, number, number, number, string, string]> = [
    [0, 0, baseProb, day0Sum, snap.hourly?.[2]?.conditionCode ?? 'PARTLY_CLOUDY', snap.conditionText],
    [0.8, 0.4, Math.max(10, Math.round(baseProb * 0.75)), round1(day0Sum * 0.6), 'PARTLY_CLOUDY', 'Có mây rải rác'],
    [1.3, 0.6, Math.min(85, Math.max(15, Math.round(baseProb * 0.5 + 15))), round1(day0Sum * 0.3), 'MOSTLY_CLEAR', 'Nắng dịu dễ chịu'],
    [-0.6, -0.5, Math.min(90, Math.round(baseProb * 0.8 + 20)), round1(Math.max(0, day0Sum * 0.8 + 1.2)), baseProb >= 50 ? 'LIGHT_RAIN' : 'MOSTLY_CLOUDY', baseProb >= 50 ? 'Mưa nhỏ rải rác' : 'Nắng dịu có mây'],
    [0.4, -0.2, 20, 0, 'PARTLY_CLOUDY', 'Trời tạnh ráo'],
    [1.1, 0.3, 15, 0, 'CLEAR', 'Trời nắng quang đãng'],
    [0.7, 0.2, 25, 0.4, 'PARTLY_CLOUDY', 'Có mây rải rác'],
  ];

  return offsets.map(([dHi, dLo, prob, sumMm, code, textVi], idx) => {
    const dayMs = baseMs + idx * 86_400_000;
    const shifted = new Date(dayMs + offsetSec * 1000);
    const yyyy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    const solar = computeSolarAndMoonCycle(
      new Date(dayMs).toISOString(),
      snap.latitude,
      snap.longitude,
      offsetSec
    );
    return {
      dateIso: `${yyyy}-${mm}-${dd}`,
      tempMinC: round1(baseLo + dLo),
      tempMaxC: round1(Math.max(baseLo + dLo + 2, baseHi + dHi)),
      precipProbMaxPct: Math.max(0, Math.min(100, prob)),
      precipSumMm: Math.max(0, sumMm),
      uvIndexMax: Math.max(2, round1((snap.uvIndex || 5) + (idx % 2 === 0 ? 0.5 : -0.5))),
      conditionCode: code,
      conditionTextVi: textVi,
      sunriseTimeVi: solar.sunriseTimeVi,
      sunsetTimeVi: solar.sunsetTimeVi,
    };
  });
}

function enrichSnapshotDerivedFields(snap: WeatherSnapshot): WeatherSnapshot {
  if (typeof snap.dewPointC !== 'number' || !Number.isFinite(snap.dewPointC)) {
    snap.dewPointC = computeDewPointC(snap.temperatureC, snap.humidityPct);
  }
  const solar = computeSolarAndMoonCycle(
    snap.updatedAtIso,
    snap.latitude,
    snap.longitude,
    snap.utcOffsetSeconds
  );
  if (!snap.sunriseTimeVi) snap.sunriseTimeVi = solar.sunriseTimeVi;
  if (!snap.sunsetTimeVi) snap.sunsetTimeVi = solar.sunsetTimeVi;
  if (!snap.moonPhaseVi) snap.moonPhaseVi = solar.moonPhaseVi;
  if (typeof snap.surfacePressureHpa !== 'number') {
    snap.surfacePressureHpa = snap.precipMmPerHr >= 2 ? 1006.5 : 1012.4;
  }
  if (typeof snap.visibilityKm !== 'number') {
    snap.visibilityKm = snap.precipMmPerHr >= 4 ? 4.5 : snap.aqi && snap.aqi >= 130 ? 5.8 : 10.0;
  }
  if (typeof snap.pm25 !== 'number' && typeof snap.aqi === 'number') {
    snap.pm25 = round1(
      snap.aqi <= 50
        ? (snap.aqi / 50) * 9.0
        : snap.aqi <= 100
          ? 9.1 + ((snap.aqi - 51) / 49) * 26.3
          : 35.5 + ((snap.aqi - 101) / 49) * 19.9
    );
  }
  if (typeof snap.pm10 !== 'number' && typeof snap.pm25 === 'number') {
    snap.pm10 = round1(snap.pm25 * 1.65);
  }
  if (!Array.isArray(snap.daily) || snap.daily.length < 7) {
    const existing = Array.isArray(snap.daily) ? snap.daily : [];
    const fallback = synthesize7DayForecast(snap);
    snap.daily = fallback.map((fb, idx) => existing[idx] ?? fb);
  }
  return snap;
}

for (const preset of Object.values(DEMO_WEATHER_PRESETS)) {
  enrichSnapshotDerivedFields(preset);
}

async function enrichWithOpenMeteoAqi(
  snapshot: WeatherSnapshot,
  lat: number,
  lon: number,
  fetchImpl: typeof fetch
): Promise<WeatherSnapshot> {
  const details = await fetchOpenMeteoAqiDetails(lat, lon, fetchImpl);
  if (typeof snapshot.aqi !== 'number' && typeof details.aqi === 'number') {
    snapshot.aqi = details.aqi;
  }
  if (typeof snapshot.pm25 !== 'number' && typeof details.pm25 === 'number') {
    snapshot.pm25 = details.pm25;
  }
  if (typeof snapshot.pm10 !== 'number' && typeof details.pm10 === 'number') {
    snapshot.pm10 = details.pm10;
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
  enableConsensus?: boolean;
  consensusTimeoutMs?: number;
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
    enableConsensus,
    consensusTimeoutMs,
  } = params;

  const trimmedTomorrow = tomorrowIoApiKey?.trim() ?? '';
  const trimmedWeatherApi = weatherApiKey?.trim() ?? '';
  const trimmedGoogle = googleApiKey?.trim() ?? '';

  const shouldRunConsensus =
    enableConsensus !== false &&
    (fetchImpl === globalThis.fetch || enableConsensus === true);

  const finalize = async (snap: WeatherSnapshot): Promise<WeatherSnapshot> => {
    enrichSnapshotDerivedFields(snap);
    if (!shouldRunConsensus) {
      return snap;
    }
    const verified = await crossValidateWeatherSnapshot(snap, {
      fetchImpl,
      timeoutMs: consensusTimeoutMs,
    });
    return enrichSnapshotDerivedFields(verified);
  };

  if (provider === 'open_meteo') {
    const snap = await fetchOpenMeteoWeather(latitude, longitude, locationName, fetchImpl);
    return finalize(snap);
  }

  if (provider === 'tomorrow_io') {
    if (!trimmedTomorrow) {
      throw new Error(
        'Vui lòng nhập Tomorrow.io API Key (miễn phí, không cần thẻ) hoặc chuyển sang Tự động.'
      );
    }
    const [snap, aqiDetails] = await Promise.all([
      fetchTomorrowIoWeather(latitude, longitude, locationName, trimmedTomorrow, fetchImpl),
      fetchOpenMeteoAqiDetails(latitude, longitude, fetchImpl),
    ]);
    if (snap.aqi === undefined && typeof aqiDetails.aqi === 'number') snap.aqi = aqiDetails.aqi;
    if (snap.pm25 === undefined && typeof aqiDetails.pm25 === 'number') snap.pm25 = aqiDetails.pm25;
    if (snap.pm10 === undefined && typeof aqiDetails.pm10 === 'number') snap.pm10 = aqiDetails.pm10;
    return finalize(snap);
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
    const withAqi = await enrichWithOpenMeteoAqi(snap, latitude, longitude, fetchImpl);
    return finalize(withAqi);
  }

  if (provider === 'google') {
    if (!trimmedGoogle) {
      throw new Error(
        'Vui lòng nhập Google Cloud Weather API Key để sử dụng nguồn Google Weather.'
      );
    }
    const [googleSnap, aqiDetails] = await Promise.all([
      fetchGoogleWeather(latitude, longitude, locationName, trimmedGoogle, fetchImpl),
      fetchOpenMeteoAqiDetails(latitude, longitude, fetchImpl),
    ]);
    if (googleSnap.aqi === undefined && typeof aqiDetails.aqi === 'number') googleSnap.aqi = aqiDetails.aqi;
    if (googleSnap.pm25 === undefined && typeof aqiDetails.pm25 === 'number') googleSnap.pm25 = aqiDetails.pm25;
    if (googleSnap.pm10 === undefined && typeof aqiDetails.pm10 === 'number') googleSnap.pm10 = aqiDetails.pm10;
    return finalize(googleSnap);
  }

  // provider === 'auto': Prefer no-card high-accuracy keys first (Tomorrow.io -> WeatherAPI),
  // then Google WeatherNext if configured, and always fall back cleanly to Open-Meteo Free.
  if (trimmedTomorrow.length > 0) {
    try {
      const [snap, aqiDetails] = await Promise.all([
        fetchTomorrowIoWeather(latitude, longitude, locationName, trimmedTomorrow, fetchImpl),
        fetchOpenMeteoAqiDetails(latitude, longitude, fetchImpl),
      ]);
      if (snap.aqi === undefined && typeof aqiDetails.aqi === 'number') snap.aqi = aqiDetails.aqi;
      if (snap.pm25 === undefined && typeof aqiDetails.pm25 === 'number') snap.pm25 = aqiDetails.pm25;
      if (snap.pm10 === undefined && typeof aqiDetails.pm10 === 'number') snap.pm10 = aqiDetails.pm10;
      return finalize(snap);
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
      const withAqi = await enrichWithOpenMeteoAqi(snap, latitude, longitude, fetchImpl);
      return finalize(withAqi);
    } catch {
      // Fall through to next available provider
    }
  }

  if (trimmedGoogle.length > 0) {
    try {
      const [googleSnap, aqiDetails] = await Promise.all([
        fetchGoogleWeather(latitude, longitude, locationName, trimmedGoogle, fetchImpl),
        fetchOpenMeteoAqiDetails(latitude, longitude, fetchImpl),
      ]);
      if (googleSnap.aqi === undefined && typeof aqiDetails.aqi === 'number') googleSnap.aqi = aqiDetails.aqi;
      if (googleSnap.pm25 === undefined && typeof aqiDetails.pm25 === 'number') googleSnap.pm25 = aqiDetails.pm25;
      if (googleSnap.pm10 === undefined && typeof aqiDetails.pm10 === 'number') googleSnap.pm10 = aqiDetails.pm10;
      return finalize(googleSnap);
    } catch {
      // Fall through to Open-Meteo Free
    }
  }

  const snap = await fetchOpenMeteoWeather(latitude, longitude, locationName, fetchImpl);
  return finalize(snap);
}
