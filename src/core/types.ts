export type Gender = 'male' | 'female';

export type ThermalSensitivity = 'cold_sensitive' | 'normal' | 'heat_sensitive';

export type WeatherProviderType =
  | 'auto'
  | 'tomorrow_io'
  | 'weatherapi'
  | 'google'
  | 'open_meteo';

export const AUTO_REFRESH_INTERVAL_MINUTES = 15;
export const AUTO_REFRESH_INTERVAL_MS = AUTO_REFRESH_INTERVAL_MINUTES * 60 * 1000;

export type CharacterSceneId =
  | 'storm_raincoat'
  | 'light_rain_umbrella'
  | 'hot_sunny'
  | 'pleasant_sunny'
  | 'clear_night'
  | 'chilly_cozy'
  | 'freezing_puffer';

export type SkyTheme =
  | 'dawn'
  | 'day_sunny'
  | 'day_cloudy'
  | 'rain_storm'
  | 'sunset'
  | 'night';

export interface HourlyForecastPoint {
  timeIso: string;
  temperatureC: number;
  precipProbPct: number;
  precipMm: number;
  conditionCode: string;
}

export interface WeatherSnapshot {
  provider: 'tomorrow_io' | 'weatherapi' | 'google' | 'open_meteo' | 'demo';
  locationName: string;
  latitude: number;
  longitude: number;
  updatedAtIso: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windGustKmh: number;
  uvIndex: number;
  precipMmPerHr: number;
  precipProbPct: number;
  conditionText: string;
  isDay: boolean;
  aqi?: number;
  hourly: HourlyForecastPoint[];
}

export interface CharacterDecision {
  sceneId: CharacterSceneId;
  gender: Gender;
  hasRainAheadProp: boolean;
  rainAheadHours: number | null;
  hasAqiMask: boolean;
  skyTheme: SkyTheme;
  headlineVi: string;
  outfitAdviceVi: string;
  badgeVi: string;
}

export interface PresetCity {
  id: string;
  nameVi: string;
  regionVi: string;
  latitude: number;
  longitude: number;
}

export const PRESET_CITIES: PresetCity[] = [
  {
    id: 'ha_noi',
    nameVi: 'Hà Nội',
    regionVi: 'Miền Bắc',
    latitude: 21.0285,
    longitude: 105.8542,
  },
  {
    id: 'tp_hcm',
    nameVi: 'TP. Hồ Chí Minh',
    regionVi: 'Miền Nam',
    latitude: 10.8231,
    longitude: 106.6297,
  },
  {
    id: 'da_lat',
    nameVi: 'Đà Lạt',
    regionVi: 'Tây Nguyên',
    latitude: 11.9404,
    longitude: 108.4583,
  },
  {
    id: 'da_nang',
    nameVi: 'Đà Nẵng',
    regionVi: 'Miền Trung',
    latitude: 16.0544,
    longitude: 108.2022,
  },
  {
    id: 'sa_pa',
    nameVi: 'Sa Pa',
    regionVi: 'Tây Bắc',
    latitude: 22.3364,
    longitude: 103.8438,
  },
  {
    id: 'can_tho',
    nameVi: 'Cần Thơ',
    regionVi: 'Miền Tây',
    latitude: 10.0452,
    longitude: 105.7469,
  },
];
