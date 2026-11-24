import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import {
  AUTO_REFRESH_INTERVAL_MINUTES,
  AUTO_REFRESH_INTERVAL_MS,
  DEMO_WEATHER_PRESETS,
  evaluateCharacterDecision,
  fetchWeatherSnapshot,
  NPC_ROTATION_INTERVAL_MS,
  NPC_STAND_DURATION_MS,
  pickNextRandomNpcAction,
  PRESET_CITIES,
  type CharacterDecision,
  type Gender,
  type NpcActionId,
  type PresetCity,
  type ThermalSensitivity,
  type WeatherProviderType,
  type WeatherSnapshot,
} from '../core';
import {
  buildWidgetPayload,
  syncWidgetState,
  type WidgetSyncPayload,
  type WidgetSyncResult,
} from '../widgets/widgetBridge';

const PREFS_STORAGE_KEY = 'weather_buddy_user_prefs_v2';
const LEGACY_PREFS_STORAGE_KEY = 'weather_buddy_user_prefs_v1';

export type LocationSource = 'gps' | 'ip';

interface PersistedUserPrefs {
  gender: Gender;
  sensitivity: ThermalSensitivity;
  providerPref: WeatherProviderType;
  tomorrowIoApiKey: string;
  weatherApiKey: string;
  googleApiKey: string;
  selectedCityId: string;
  customGpsCoords?: {
    latitude: number;
    longitude: number;
    locationName: string;
    accuracyMeters?: number | null;
    locationSource?: LocationSource;
  } | null;
}

const DEFAULT_PREFS: PersistedUserPrefs = {
  gender: 'female',
  sensitivity: 'normal',
  providerPref: 'auto',
  tomorrowIoApiKey: '',
  weatherApiKey: '',
  googleApiKey: '',
  selectedCityId: 'ha_noi',
  customGpsCoords: null,
};

let memoryPrefsFallback: PersistedUserPrefs = { ...DEFAULT_PREFS };
let hasMemorySavedPrefs = false;

function loadPersistedPrefs(): {
  prefs: PersistedUserPrefs;
  hasSavedPrefs: boolean;
} {
  try {
    const scope = globalThis as unknown as {
      localStorage?: {
        getItem(k: string): string | null;
        removeItem?(k: string): void;
      };
    };
    scope.localStorage?.removeItem?.(LEGACY_PREFS_STORAGE_KEY);
    const raw = scope.localStorage?.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedUserPrefs>;
      const rawCoords = parsed.customGpsCoords;
      const normalizedCoords =
        rawCoords &&
        typeof rawCoords.latitude === 'number' &&
        Number.isFinite(rawCoords.latitude) &&
        typeof rawCoords.longitude === 'number' &&
        Number.isFinite(rawCoords.longitude)
          ? {
              latitude: rawCoords.latitude,
              longitude: rawCoords.longitude,
              locationName:
                typeof rawCoords.locationName === 'string' &&
                rawCoords.locationName.trim()
                  ? rawCoords.locationName.trim()
                  : 'Vị trí hiện tại',
              accuracyMeters: rawCoords.accuracyMeters ?? null,
              locationSource:
                rawCoords.locationSource === 'ip'
                  ? ('ip' as const)
                  : ('gps' as const),
            }
          : null;

      return {
        hasSavedPrefs: true,
        prefs: {
          gender: parsed.gender === 'male' ? 'male' : 'female',
          sensitivity:
            parsed.sensitivity === 'cold_sensitive' ||
            parsed.sensitivity === 'heat_sensitive'
              ? parsed.sensitivity
              : 'normal',
          providerPref:
            parsed.providerPref === 'tomorrow_io' ||
            parsed.providerPref === 'weatherapi' ||
            parsed.providerPref === 'google' ||
            parsed.providerPref === 'open_meteo'
              ? parsed.providerPref
              : 'auto',
          tomorrowIoApiKey:
            typeof parsed.tomorrowIoApiKey === 'string'
              ? parsed.tomorrowIoApiKey.trim()
              : '',
          weatherApiKey:
            typeof parsed.weatherApiKey === 'string'
              ? parsed.weatherApiKey.trim()
              : '',
          googleApiKey:
            typeof parsed.googleApiKey === 'string'
              ? parsed.googleApiKey.trim()
              : '',
          selectedCityId:
            typeof parsed.selectedCityId === 'string'
              ? parsed.selectedCityId
              : 'ha_noi',
          customGpsCoords: normalizedCoords,
        },
      };
    }
  } catch {
    // Ignore storage read restrictions
  }
  return {
    prefs: { ...memoryPrefsFallback },
    hasSavedPrefs: hasMemorySavedPrefs,
  };
}

function savePersistedPrefs(prefs: PersistedUserPrefs): void {
  hasMemorySavedPrefs = true;
  memoryPrefsFallback = prefs;
  try {
    const scope = globalThis as unknown as {
      localStorage?: { setItem(k: string, v: string): void };
    };
    scope.localStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage write restrictions
  }
}

export function resolveBackendBaseUrl(): string {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location?.port === '8787'
  ) {
    return '';
  }
  return 'http://localhost:8787';
}

export async function fetchWeatherWithBackendFallback(params: {
  latitude: number;
  longitude: number;
  locationName: string;
  provider?: WeatherProviderType;
  tomorrowIoApiKey?: string;
  weatherApiKey?: string;
  googleApiKey?: string;
}): Promise<WeatherSnapshot> {
  if (Platform.OS === 'web') {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), 4500)
      : null;

    try {
      const base = resolveBackendBaseUrl();
      const qs = new URLSearchParams({
        lat: String(params.latitude),
        lon: String(params.longitude),
        locationName: params.locationName,
        provider: params.provider ?? 'auto',
      });
      const headers: Record<string, string> = {
        'X-WeatherBuddy-Client': 'weatherbuddy-ui',
      };
      if (params.googleApiKey?.trim()) {
        headers['X-Google-Api-Key'] = params.googleApiKey.trim();
      }
      if (params.tomorrowIoApiKey?.trim()) {
        headers['X-Tomorrow-Api-Key'] = params.tomorrowIoApiKey.trim();
      }
      if (params.weatherApiKey?.trim()) {
        headers['X-Weatherapi-Key'] = params.weatherApiKey.trim();
      }

      const res = await fetch(`${base}/api/weather?${qs.toString()}`, {
        method: 'GET',
        headers,
        signal: controller ? controller.signal : undefined,
      });
      if (res.ok) {
        const body = (await res.json()) as { snapshot?: WeatherSnapshot };
        if (body?.snapshot && typeof body.snapshot.temperatureC === 'number') {
          return body.snapshot;
        }
      }
    } catch {
      // Backend port 8787 offline -> seamlessly fall back to direct client fetch
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  return fetchWeatherSnapshot(params);
}

interface ReverseGeocodeResponse {
  locationName?: string;
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  latitude?: number;
  longitude?: number;
}

interface AutoLocateBackendResponse {
  status?: string;
  source?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
}

interface IpWhoResponse {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
}

const ASCII_VI_CITY_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/^ho chi minh(?: city)?$/i, 'TP. Hồ Chí Minh'],
  [/^tp\.?\s*ho chi minh$/i, 'TP. Hồ Chí Minh'],
  [/^thanh pho ho chi minh$/i, 'TP. Hồ Chí Minh'],
  [/^(?:tp\.?\s*)?hồ chí minh$/i, 'TP. Hồ Chí Minh'],
  [/^saigon$|^sai gon$/i, 'TP. Hồ Chí Minh'],
  [/^ha noi$|^hanoi$/i, 'Hà Nội'],
  [/^da nang$|^danang$/i, 'Đà Nẵng'],
  [/^da lat$|^dalat$/i, 'Đà Lạt'],
  [/^can tho$|^cantho$/i, 'Cần Thơ'],
  [/^hai phong$|^haiphong$/i, 'Hải Phòng'],
  [/^nha trang$/i, 'Nha Trang'],
  [/^binh duong$/i, 'Bình Dương'],
  [/^dong nai$/i, 'Đồng Nai'],
  [/^ba ria\s*-?\s*vung tau$|^vung tau$/i, 'Vũng Tàu'],
  [/^hue$|^thua thien hue$/i, 'Huế'],
];

function cleanVietnamesePlaceToken(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    return '';
  }
  const cleaned = raw
    .trim()
    .replace(/^Thành phố\s+/i, 'TP. ')
    .replace(/^Tỉnh\s+/i, '')
    .replace(/\s+/g, ' ');

  for (const [pattern, viName] of ASCII_VI_CITY_MAP) {
    if (pattern.test(cleaned)) {
      return viName;
    }
  }
  return cleaned;
}

function findNearestPresetCityName(lat: number, lon: number): string | null {
  let best: PresetCity | null = null;
  let bestDistSq = Infinity;
  for (const city of PRESET_CITIES) {
    const dLat = lat - city.latitude;
    const dLon = lon - city.longitude;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = city;
    }
  }
  if (best && bestDistSq <= 0.25 * 0.25) {
    return best.nameVi;
  }
  return null;
}

async function fetchJsonWithAbort<T>(
  url: string,
  timeoutMs: number
): Promise<T | null> {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const res = await fetch(
      url,
      controller ? { signal: controller.signal } : undefined
    );
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function resolveVietnamesePlaceName(
  latitude: number,
  longitude: number
): Promise<string> {
  // 1. Try local Backend Server proxy (/api/reverse-geocode) first when on Web
  if (Platform.OS === 'web') {
    const base = resolveBackendBaseUrl();
    const bData = await fetchJsonWithAbort<ReverseGeocodeResponse>(
      `${base}/api/reverse-geocode?lat=${encodeURIComponent(
        String(latitude)
      )}&lon=${encodeURIComponent(String(longitude))}`,
      2200
    );
    if (bData?.locationName && bData.locationName.trim()) {
      return cleanVietnamesePlaceToken(bData.locationName);
    }
  }

  // 2. Direct zero-key CORS-friendly Vietnamese reverse geocode
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
    String(latitude)
  )}&longitude=${encodeURIComponent(String(longitude))}&localityLanguage=vi`;
  const data = await fetchJsonWithAbort<ReverseGeocodeResponse>(url, 3500);
  if (data) {
    const locality = cleanVietnamesePlaceToken(data.locality);
    const city = cleanVietnamesePlaceToken(
      data.city || data.principalSubdivision
    );

    if (
      locality &&
      city &&
      locality.toLowerCase() !== city.toLowerCase() &&
      !city.toLowerCase().includes(locality.toLowerCase())
    ) {
      return `${locality}, ${city}`;
    }
    if (city) {
      return city;
    }
    if (locality) {
      return locality;
    }
  }

  return findNearestPresetCityName(latitude, longitude) ?? 'Vị trí hiện tại';
}

interface GeolocationPositionLike {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

interface GeolocationErrorLike {
  code?: number;
  message?: string;
}

interface GeolocationApiLike {
  getCurrentPosition: (
    success: (pos: GeolocationPositionLike) => void,
    error: (err: GeolocationErrorLike) => void,
    options?: {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    }
  ) => void;
}

function getBrowserPositionPromise(
  geolocation: GeolocationApiLike,
  options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number }
): Promise<GeolocationPositionLike> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const guardTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject({ code: 3, message: 'Geolocation timeout' });
      }
    }, options.timeout + 400);

    try {
      geolocation.getCurrentPosition(
        (pos) => {
          if (!settled) {
            settled = true;
            clearTimeout(guardTimer);
            resolve(pos);
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(guardTimer);
            reject(err ?? { code: 2 });
          }
        },
        options
      );
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(guardTimer);
        reject(err ?? { code: 2 });
      }
    }
  });
}

async function fetchNetworkAutoLocationFallback(): Promise<{
  latitude: number;
  longitude: number;
  locationName: string;
} | null> {
  // 3a. Local backend /api/auto-locate (cached + multi-provider + Vietnamese reverse geocode)
  if (Platform.OS === 'web') {
    const base = resolveBackendBaseUrl();
    const backendLoc = await fetchJsonWithAbort<AutoLocateBackendResponse>(
      `${base}/api/auto-locate`,
      4000
    );
    if (
      backendLoc &&
      backendLoc.status === 'ok' &&
      typeof backendLoc.latitude === 'number' &&
      Number.isFinite(backendLoc.latitude) &&
      typeof backendLoc.longitude === 'number' &&
      Number.isFinite(backendLoc.longitude)
    ) {
      const lat = Number(backendLoc.latitude.toFixed(5));
      const lon = Number(backendLoc.longitude.toFixed(5));
      const locationName =
        cleanVietnamesePlaceToken(backendLoc.locationName || backendLoc.city) ||
        findNearestPresetCityName(lat, lon) ||
        'Vị trí hiện tại';
      return { latitude: lat, longitude: lon, locationName };
    }
  }

  // 3b. Direct client fallback: ipwho.is (?lang=vi)
  const ipwho = await fetchJsonWithAbort<IpWhoResponse>(
    'https://ipwho.is/?lang=vi',
    4000
  );
  if (
    ipwho &&
    ipwho.success !== false &&
    typeof ipwho.latitude === 'number' &&
    Number.isFinite(ipwho.latitude) &&
    typeof ipwho.longitude === 'number' &&
    Number.isFinite(ipwho.longitude)
  ) {
    const lat = Number(ipwho.latitude.toFixed(5));
    const lon = Number(ipwho.longitude.toFixed(5));
    let cityLabel = cleanVietnamesePlaceToken(ipwho.city || ipwho.region);
    if (!cityLabel || /^[A-Za-z\s.-]+$/.test(cityLabel)) {
      const bdcEnrich = await fetchJsonWithAbort<ReverseGeocodeResponse>(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
          String(lat)
        )}&longitude=${encodeURIComponent(String(lon))}&localityLanguage=vi`,
        3200
      );
      if (bdcEnrich) {
        const viCity = cleanVietnamesePlaceToken(
          bdcEnrich.city || bdcEnrich.principalSubdivision || bdcEnrich.locality
        );
        if (viCity) {
          cityLabel = viCity;
        }
      }
    }
    const locationName =
      cityLabel || findNearestPresetCityName(lat, lon) || 'Vị trí hiện tại';
    return { latitude: lat, longitude: lon, locationName };
  }

  // 3c. Secondary direct client fallback: BigDataCloud client-IP reverse geocode
  const bdcIp = await fetchJsonWithAbort<ReverseGeocodeResponse>(
    'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=vi',
    4000
  );
  if (
    bdcIp &&
    typeof bdcIp.latitude === 'number' &&
    Number.isFinite(bdcIp.latitude) &&
    typeof bdcIp.longitude === 'number' &&
    Number.isFinite(bdcIp.longitude)
  ) {
    const lat = Number(bdcIp.latitude.toFixed(5));
    const lon = Number(bdcIp.longitude.toFixed(5));
    const locationName =
      cleanVietnamesePlaceToken(
        bdcIp.city || bdcIp.principalSubdivision || bdcIp.locality
      ) ||
      findNearestPresetCityName(lat, lon) ||
      'Vị trí hiện tại';
    return { latitude: lat, longitude: lon, locationName };
  }

  return null;
}

// --- Shared Autonomous NPC Idle & Stand-Up-On-Tap Store ---
export interface NpcStageSnapshot {
  npcAction: NpcActionId;
  isStanding: boolean;
  standTriggerCount: number;
}

let npcSnapshot: NpcStageSnapshot = {
  npcAction: pickNextRandomNpcAction(null),
  isStanding: false,
  standTriggerCount: 0,
};

const npcListeners = new Set<() => void>();
let npcRotationTimer: ReturnType<typeof setInterval> | null = null;
let npcStandTimeout: ReturnType<typeof setTimeout> | null = null;

function emitNpcSnapshot(): void {
  npcListeners.forEach((listener) => listener());
}

function restartNpcRotationTimer(): void {
  if (npcRotationTimer) {
    clearInterval(npcRotationTimer);
    npcRotationTimer = null;
  }
  if (npcListeners.size === 0) {
    return;
  }
  npcRotationTimer = setInterval(() => {
    if (npcStandTimeout) {
      clearTimeout(npcStandTimeout);
      npcStandTimeout = null;
    }
    npcSnapshot = {
      ...npcSnapshot,
      npcAction: pickNextRandomNpcAction(npcSnapshot.npcAction),
      isStanding: false,
    };
    emitNpcSnapshot();
  }, NPC_ROTATION_INTERVAL_MS);
}

function subscribeNpcStore(listener: () => void): () => void {
  const wasEmpty = npcListeners.size === 0;
  npcListeners.add(listener);
  if (wasEmpty) {
    restartNpcRotationTimer();
  }
  return () => {
    npcListeners.delete(listener);
    if (npcListeners.size === 0) {
      if (npcRotationTimer) {
        clearInterval(npcRotationTimer);
        npcRotationTimer = null;
      }
      if (npcStandTimeout) {
        clearTimeout(npcStandTimeout);
        npcStandTimeout = null;
      }
    }
  };
}

function getNpcSnapshot(): NpcStageSnapshot {
  return npcSnapshot;
}

export const NPC_OUTFIT_SHOWCASE_MS = 5500;

export function triggerNpcCharacterInteraction(
  pinStanding = false,
  durationMs: number = NPC_OUTFIT_SHOWCASE_MS
): void {
  if (npcStandTimeout) {
    clearTimeout(npcStandTimeout);
    npcStandTimeout = null;
  }

  npcSnapshot = {
    ...npcSnapshot,
    isStanding: true,
    standTriggerCount: npcSnapshot.standTriggerCount + 1,
  };
  emitNpcSnapshot();

  if (!pinStanding) {
    const standMs =
      Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : NPC_STAND_DURATION_MS;
    npcStandTimeout = setTimeout(() => {
      npcStandTimeout = null;
      npcSnapshot = {
        ...npcSnapshot,
        isStanding: false,
      };
      emitNpcSnapshot();
    }, standMs);
  }
}

export function shuffleRandomNpcAction(): void {
  if (npcStandTimeout) {
    clearTimeout(npcStandTimeout);
    npcStandTimeout = null;
  }

  npcSnapshot = {
    ...npcSnapshot,
    npcAction: pickNextRandomNpcAction(npcSnapshot.npcAction),
    isStanding: false,
  };
  restartNpcRotationTimer();
  emitNpcSnapshot();
}

export interface NpcStageControls extends NpcStageSnapshot {
  interactWithCharacter: () => void;
  shuffleNpcAction: () => void;
}

export function useNpcStageController(): NpcStageControls {
  const snap = useSyncExternalStore(
    subscribeNpcStore,
    getNpcSnapshot,
    getNpcSnapshot
  );

  return {
    npcAction: snap.npcAction,
    isStanding: snap.isStanding,
    standTriggerCount: snap.standTriggerCount,
    interactWithCharacter: () => triggerNpcCharacterInteraction(false),
    shuffleNpcAction: shuffleRandomNpcAction,
  };
}

export type ScenarioSelection = 'live' | keyof typeof DEMO_WEATHER_PRESETS;

export interface UseWeatherBuddyState {
  gender: Gender;
  setGender: (g: Gender) => void;
  toggleGender: () => void;
  sensitivity: ThermalSensitivity;
  setSensitivity: (s: ThermalSensitivity) => void;
  providerPref: WeatherProviderType;
  setProviderPref: (p: WeatherProviderType) => void;
  tomorrowIoApiKey: string;
  setTomorrowIoApiKey: (key: string) => void;
  weatherApiKey: string;
  setWeatherApiKey: (key: string) => void;
  googleApiKey: string;
  setGoogleApiKey: (key: string) => void;
  refreshIntervalMinutes: number;
  selectedCityId: string;
  selectPresetCity: (cityId: string) => void;
  requestDeviceLocation: () => void;
  gpsLoading: boolean;
  gpsError: string | null;
  gpsSource: LocationSource | null;
  activeScenarioId: ScenarioSelection;
  setActiveScenarioId: (scenario: ScenarioSelection) => void;
  activeWeather: WeatherSnapshot;
  liveWeather: WeatherSnapshot | null;
  decision: CharacterDecision;
  widgetPayload: WidgetSyncPayload;
  lastWidgetSync: (WidgetSyncResult & { syncedAtFormatted: string }) | null;
  triggerManualWidgetSync: () => Promise<void>;
  isLoadingLive: boolean;
  liveError: string | null;
  refreshLiveWeather: () => Promise<void>;
  reduceMotion: boolean;
  npcAction: NpcActionId;
  isStanding: boolean;
  interactWithCharacter: () => void;
  shuffleNpcAction: () => void;
}

function reanchorPresetToToday(
  preset: WeatherSnapshot,
  useCurrentClockHour: boolean
): WeatherSnapshot {
  const now = new Date();
  let anchorMs = now.getTime();

  if (!useCurrentClockHour) {
    // Keep the preset's intended time of day (morning/noon/evening/night) on TODAY's real calendar date
    const parsedPreset = new Date(preset.updatedAtIso);
    const target = new Date(now);
    if (!Number.isNaN(parsedPreset.getTime())) {
      target.setHours(parsedPreset.getHours(), 0, 0, 0);
    } else {
      target.setHours(preset.isDay ? 10 : 21, 0, 0, 0);
    }
    anchorMs = target.getTime();
  }

  const nextHourFloor = new Date(anchorMs);
  nextHourFloor.setMinutes(0, 0, 0);
  const firstSlotMs = nextHourFloor.getTime() + 3600_000;
  const localHour = new Date(anchorMs).getHours();

  return {
    ...preset,
    updatedAtIso: new Date(anchorMs).toISOString(),
    isDay: useCurrentClockHour ? localHour >= 6 && localHour < 18 : preset.isDay,
    hourly: (preset.hourly ?? []).map((pt, idx) => ({
      ...pt,
      timeIso: new Date(firstSlotMs + idx * 3600_000).toISOString(),
    })),
  };
}

export function useWeatherBuddy(): UseWeatherBuddyState {
  const initialPrefsBundle = useMemo(() => loadPersistedPrefs(), []);
  const initialPrefs = initialPrefsBundle.prefs;
  const npcStage = useNpcStageController();

  const [gender, setGenderState] = useState<Gender>(initialPrefs.gender);
  const [sensitivity, setSensitivityState] = useState<ThermalSensitivity>(
    initialPrefs.sensitivity
  );
  const [providerPref, setProviderPrefState] = useState<WeatherProviderType>(
    initialPrefs.providerPref
  );
  const [tomorrowIoApiKey, setTomorrowIoApiKeyState] = useState<string>(
    initialPrefs.tomorrowIoApiKey
  );
  const [weatherApiKey, setWeatherApiKeyState] = useState<string>(
    initialPrefs.weatherApiKey
  );
  const [googleApiKey, setGoogleApiKeyState] = useState<string>(
    initialPrefs.googleApiKey
  );
  const [selectedCityId, setSelectedCityId] = useState<string>(
    initialPrefs.selectedCityId
  );
  const [customGpsCoords, setCustomGpsCoords] = useState<
    PersistedUserPrefs['customGpsCoords']
  >(initialPrefs.customGpsCoords ?? null);

  const [activeScenarioId, setActiveScenarioId] =
    useState<ScenarioSelection>('live');
  const [liveWeather, setLiveWeather] = useState<WeatherSnapshot | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastWidgetSync, setLastWidgetSync] = useState<
    (WidgetSyncResult & { syncedAtFormatted: string }) | null
  >(null);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  const fetchSeqRef = useRef<number>(0);
  const lastLiveFetchAtRef = useRef<number>(0);
  const geoSeqRef = useRef<number>(0);
  const autoDetectedInitialMountRef = useRef<boolean>(false);

  // Detect OS / browser reduced-motion preference
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => {
        if (mounted) {
          setReduceMotion(Boolean(enabled));
        }
      }
    );

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mql.matches && mounted) {
        setReduceMotion(true);
      }
    }

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  // Persist user preferences whenever they change
  useEffect(() => {
    savePersistedPrefs({
      gender,
      sensitivity,
      providerPref,
      tomorrowIoApiKey,
      weatherApiKey,
      googleApiKey,
      selectedCityId,
      customGpsCoords,
    });
  }, [
    gender,
    sensitivity,
    providerPref,
    tomorrowIoApiKey,
    weatherApiKey,
    googleApiKey,
    selectedCityId,
    customGpsCoords,
  ]);

  const activeCityTarget = useMemo((): {
    latitude: number;
    longitude: number;
    locationName: string;
  } => {
    if (selectedCityId === 'gps' && customGpsCoords) {
      return customGpsCoords;
    }
    const found: PresetCity | undefined = PRESET_CITIES.find(
      (c) => c.id === selectedCityId
    );
    const city = found ?? PRESET_CITIES[0];
    return {
      latitude: city.latitude,
      longitude: city.longitude,
      locationName: city.nameVi,
    };
  }, [selectedCityId, customGpsCoords]);

  const refreshLiveWeather = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setIsLoadingLive(true);
    setLiveError(null);

    try {
      let snapshot: WeatherSnapshot;
      try {
        snapshot = await fetchWeatherWithBackendFallback({
          latitude: activeCityTarget.latitude,
          longitude: activeCityTarget.longitude,
          locationName: activeCityTarget.locationName,
          provider: providerPref,
          tomorrowIoApiKey,
          weatherApiKey,
          googleApiKey,
        });
      } catch (primaryErr: unknown) {
        if (providerPref !== 'auto') {
          // Automatically recover via 'auto' (Tomorrow.io if server key present -> Open-Meteo + METAR)
          snapshot = await fetchWeatherWithBackendFallback({
            latitude: activeCityTarget.latitude,
            longitude: activeCityTarget.longitude,
            locationName: activeCityTarget.locationName,
            provider: 'auto',
            tomorrowIoApiKey,
            weatherApiKey,
            googleApiKey,
          });
        } else {
          throw primaryErr;
        }
      }
      if (seq === fetchSeqRef.current) {
        lastLiveFetchAtRef.current = Date.now();
        setLiveWeather(snapshot);
        setLiveError(null);
      }
    } catch (err: unknown) {
      if (seq === fetchSeqRef.current) {
        const message =
          err instanceof Error
            ? err.message
            : 'Không thể tải dữ liệu thời tiết trực tiếp lúc này.';
        setLiveError(message);
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setIsLoadingLive(false);
      }
    }
  }, [
    activeCityTarget,
    providerPref,
    tomorrowIoApiKey,
    weatherApiKey,
    googleApiKey,
  ]);

  useEffect(() => {
    refreshLiveWeather();
  }, [refreshLiveWeather]);

  // Automatic 15-minute polling + resume freshness check on native & web
  useEffect(() => {
    if (activeScenarioId !== 'live') {
      return;
    }

    const timer = setInterval(() => {
      refreshLiveWeather();
    }, AUTO_REFRESH_INTERVAL_MS);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (
        nextState === 'active' &&
        Date.now() - lastLiveFetchAtRef.current >= AUTO_REFRESH_INTERVAL_MS
      ) {
        refreshLiveWeather();
      }
    });

    const handleVisibilityChange = () => {
      if (
        typeof document !== 'undefined' &&
        !document.hidden &&
        Date.now() - lastLiveFetchAtRef.current >= AUTO_REFRESH_INTERVAL_MS
      ) {
        refreshLiveWeather();
      }
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(timer);
      appStateSub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [activeScenarioId, refreshLiveWeather]);

  const selectPresetCity = useCallback((cityId: string) => {
    geoSeqRef.current += 1;
    setGpsLoading(false);
    setGpsError(null);
    setSelectedCityId(cityId);
    setActiveScenarioId('live');
  }, []);

  const requestDeviceLocation = useCallback(() => {
    const reqSeq = ++geoSeqRef.current;
    setGpsError(null);
    setGpsLoading(true);

    const nav = (globalThis as unknown as {
      navigator?: {
        geolocation?: GeolocationApiLike;
      };
    }).navigator;

    (async () => {
      // Tier 1 & Tier 2: Browser Hardware GPS -> OS/Wi-Fi Geolocation
      if (nav?.geolocation) {
        let gpsPos: GeolocationPositionLike | null = null;
        try {
          gpsPos = await getBrowserPositionPromise(nav.geolocation, {
            enableHighAccuracy: true,
            timeout: 4000,
            maximumAge: 60000,
          });
        } catch (tier1Err: unknown) {
          const code = (tier1Err as GeolocationErrorLike | null)?.code;
          if (code !== 1) {
            try {
              gpsPos = await getBrowserPositionPromise(nav.geolocation, {
                enableHighAccuracy: false,
                timeout: 3000,
                maximumAge: 300000,
              });
            } catch {
              gpsPos = null;
            }
          }
        }

        if (
          gpsPos &&
          typeof gpsPos.coords?.latitude === 'number' &&
          Number.isFinite(gpsPos.coords.latitude) &&
          typeof gpsPos.coords?.longitude === 'number' &&
          Number.isFinite(gpsPos.coords.longitude)
        ) {
          const lat = Number(gpsPos.coords.latitude.toFixed(5));
          const lon = Number(gpsPos.coords.longitude.toFixed(5));
          const accuracyMeters =
            typeof gpsPos.coords.accuracy === 'number' &&
            Number.isFinite(gpsPos.coords.accuracy)
              ? Math.max(1, Math.round(gpsPos.coords.accuracy))
              : null;

          const resolvedPlaceName = await resolveVietnamesePlaceName(lat, lon);
          if (reqSeq !== geoSeqRef.current) {
            return;
          }
          setCustomGpsCoords({
            latitude: lat,
            longitude: lon,
            locationName: resolvedPlaceName,
            accuracyMeters,
            locationSource: 'gps',
          });
          setSelectedCityId('gps');
          setActiveScenarioId('live');
          setGpsError(null);
          setGpsLoading(false);
          return;
        }
      }

      // Tier 3: Zero-key Network/IP Geolocation Fallback (/api/auto-locate -> ipwho.is -> BigDataCloud)
      const ipFallback = await fetchNetworkAutoLocationFallback();
      if (reqSeq !== geoSeqRef.current) {
        return;
      }
      if (ipFallback) {
        setCustomGpsCoords({
          latitude: ipFallback.latitude,
          longitude: ipFallback.longitude,
          locationName: ipFallback.locationName,
          accuracyMeters: null,
          locationSource: 'ip',
        });
        setSelectedCityId('gps');
        setActiveScenarioId('live');
        setGpsError(null);
        setGpsLoading(false);
        return;
      }

      setGpsLoading(false);
      setGpsError(
        'Không thể tự động xác định vị trí lúc này. Hãy kiểm tra kết nối mạng hoặc chọn thành phố thủ công.'
      );
    })();
  }, []);

  // Auto-detect user's real local city once on first fresh visit when no prefs are saved yet
  useEffect(() => {
    if (
      !initialPrefsBundle.hasSavedPrefs &&
      !autoDetectedInitialMountRef.current
    ) {
      autoDetectedInitialMountRef.current = true;
      requestDeviceLocation();
    }
  }, [initialPrefsBundle.hasSavedPrefs, requestDeviceLocation]);

  const gpsSource: LocationSource | null = useMemo(() => {
    if (selectedCityId === 'gps' && customGpsCoords) {
      return customGpsCoords.locationSource === 'ip' ? 'ip' : 'gps';
    }
    return null;
  }, [selectedCityId, customGpsCoords]);

  const activeWeather: WeatherSnapshot = useMemo(() => {
    if (activeScenarioId !== 'live') {
      const preset = DEMO_WEATHER_PRESETS[activeScenarioId];
      if (preset) {
        return reanchorPresetToToday(preset, false);
      }
    }
    if (liveWeather) {
      return liveWeather;
    }
    const nowHour = new Date().getHours();
    const baseTemplate =
      nowHour >= 6 && nowHour < 18
        ? DEMO_WEATHER_PRESETS.sunny
        : DEMO_WEATHER_PRESETS.clear_night ?? DEMO_WEATHER_PRESETS.sunny;
    return {
      ...reanchorPresetToToday(baseTemplate, true),
      locationName: activeCityTarget.locationName,
      latitude: activeCityTarget.latitude,
      longitude: activeCityTarget.longitude,
    };
  }, [activeScenarioId, liveWeather, activeCityTarget]);

  const decision: CharacterDecision = useMemo(
    () => evaluateCharacterDecision(activeWeather, { gender, sensitivity }),
    [activeWeather, gender, sensitivity]
  );

  // Automatically showcase the new weather outfit for 5.5s whenever weather scenario, city, or sceneId changes, then settle back into active NPC behavior while keeping the outfit on
  const prevWeatherKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const weatherKey = `${activeScenarioId}|${selectedCityId}|${decision.sceneId}`;
    if (prevWeatherKeyRef.current === null) {
      prevWeatherKeyRef.current = weatherKey;
      return;
    }
    if (prevWeatherKeyRef.current !== weatherKey) {
      prevWeatherKeyRef.current = weatherKey;
      triggerNpcCharacterInteraction(false, NPC_OUTFIT_SHOWCASE_MS);
    }
  }, [activeScenarioId, selectedCityId, decision.sceneId]);

  const widgetPayload: WidgetSyncPayload = useMemo(
    () => buildWidgetPayload(activeWeather, decision),
    [activeWeather, decision]
  );

  const performWidgetSync = useCallback(async (payload: WidgetSyncPayload) => {
    const res = await syncWidgetState(payload);
    if (Platform.OS === 'web') {
      const base = resolveBackendBaseUrl();
      fetch(`${base}/api/widget-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WeatherBuddy-Client': 'weatherbuddy-ui',
        },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Ignore when backend server is not running
      });
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    setLastWidgetSync({
      ...res,
      syncedAtFormatted: `${hh}:${mm}:${ss}`,
    });
  }, []);

  useEffect(() => {
    performWidgetSync(widgetPayload);
  }, [widgetPayload, performWidgetSync]);

  const triggerManualWidgetSync = useCallback(async () => {
    await performWidgetSync(widgetPayload);
  }, [performWidgetSync, widgetPayload]);

  const setGender = useCallback((g: Gender) => {
    setGenderState(g);
  }, []);

  const toggleGender = useCallback(() => {
    setGenderState((prev) => (prev === 'male' ? 'female' : 'male'));
  }, []);

  return {
    gender,
    setGender,
    toggleGender,
    sensitivity,
    setSensitivity: setSensitivityState,
    providerPref,
    setProviderPref: setProviderPrefState,
    tomorrowIoApiKey,
    setTomorrowIoApiKey: setTomorrowIoApiKeyState,
    weatherApiKey,
    setWeatherApiKey: setWeatherApiKeyState,
    googleApiKey,
    setGoogleApiKey: setGoogleApiKeyState,
    refreshIntervalMinutes: AUTO_REFRESH_INTERVAL_MINUTES,
    selectedCityId,
    selectPresetCity,
    requestDeviceLocation,
    gpsLoading,
    gpsError,
    gpsSource,
    activeScenarioId,
    setActiveScenarioId,
    activeWeather,
    liveWeather,
    decision,
    widgetPayload,
    lastWidgetSync,
    triggerManualWidgetSync,
    isLoadingLive,
    liveError,
    refreshLiveWeather,
    reduceMotion,
    npcAction: npcStage.npcAction,
    isStanding: npcStage.isStanding,
    interactWithCharacter: npcStage.interactWithCharacter,
    shuffleNpcAction: npcStage.shuffleNpcAction,
  };
}
