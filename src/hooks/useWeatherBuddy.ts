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

function loadPersistedPrefs(): PersistedUserPrefs {
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
      return {
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
        customGpsCoords: parsed.customGpsCoords ?? null,
      };
    }
  } catch {
    // Ignore storage read restrictions
  }
  return { ...memoryPrefsFallback };
}

function savePersistedPrefs(prefs: PersistedUserPrefs): void {
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
}

function cleanVietnamesePlaceToken(raw: string | undefined): string {
  if (!raw) {
    return '';
  }
  return raw
    .trim()
    .replace(/^Thành phố\s+/i, 'TP. ')
    .replace(/^Tỉnh\s+/i, '');
}

async function resolveVietnamesePlaceName(
  latitude: number,
  longitude: number
): Promise<string> {
  // 1. Try local Backend Server proxy (/api/reverse-geocode) first when on Web
  if (Platform.OS === 'web') {
    const backendCtrl =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const backendTimer = backendCtrl
      ? setTimeout(() => backendCtrl.abort(), 2200)
      : null;
    try {
      const base = resolveBackendBaseUrl();
      const bRes = await fetch(
        `${base}/api/reverse-geocode?lat=${encodeURIComponent(
          String(latitude)
        )}&lon=${encodeURIComponent(String(longitude))}`,
        backendCtrl ? { signal: backendCtrl.signal } : undefined
      );
      if (bRes.ok) {
        const bData = (await bRes.json()) as ReverseGeocodeResponse;
        if (bData?.locationName && bData.locationName.trim()) {
          return bData.locationName.trim();
        }
      }
    } catch {
      // Fall through to direct BigDataCloud Vietnamese reverse geocode
    } finally {
      if (backendTimer) {
        clearTimeout(backendTimer);
      }
    }
  }

  // 2. Direct zero-key CORS-friendly Vietnamese reverse geocode
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), 3500)
    : null;

  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      String(latitude)
    )}&longitude=${encodeURIComponent(String(longitude))}&localityLanguage=vi`;
    const res = await fetch(
      url,
      controller ? { signal: controller.signal } : undefined
    );
    if (!res.ok) {
      return 'Vị trí hiện tại';
    }
    const data = (await res.json()) as ReverseGeocodeResponse;
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
  } catch {
    // Fallback to default label if offline or blocked
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
  return 'Vị trí hiện tại';
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

export function useWeatherBuddy(): UseWeatherBuddyState {
  const initialPrefs = useMemo(() => loadPersistedPrefs(), []);
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
      const snapshot = await fetchWeatherWithBackendFallback({
        latitude: activeCityTarget.latitude,
        longitude: activeCityTarget.longitude,
        locationName: activeCityTarget.locationName,
        provider: providerPref,
        tomorrowIoApiKey,
        weatherApiKey,
        googleApiKey,
      });
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
    setGpsError(null);
    setSelectedCityId(cityId);
    setActiveScenarioId('live');
  }, []);

  const requestDeviceLocation = useCallback(() => {
    setGpsError(null);
    const nav = (globalThis as unknown as {
      navigator?: {
        geolocation?: {
          getCurrentPosition: (
            success: (pos: {
              coords: {
                latitude: number;
                longitude: number;
                accuracy?: number;
              };
            }) => void,
            error: (err: { code?: number; message?: string }) => void,
            options?: {
              enableHighAccuracy?: boolean;
              timeout?: number;
              maximumAge?: number;
            }
          ) => void;
        };
      };
    }).navigator;

    if (!nav?.geolocation) {
      setGpsError('Thiết bị này chưa hỗ trợ định vị GPS.');
      return;
    }

    setGpsLoading(true);
    nav.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lon = Number(pos.coords.longitude.toFixed(5));
        const accuracyMeters =
          typeof pos.coords.accuracy === 'number' &&
          Number.isFinite(pos.coords.accuracy)
            ? Math.max(1, Math.round(pos.coords.accuracy))
            : null;

        const resolvedPlaceName = await resolveVietnamesePlaceName(lat, lon);
        setCustomGpsCoords({
          latitude: lat,
          longitude: lon,
          locationName: resolvedPlaceName,
          accuracyMeters,
        });
        setSelectedCityId('gps');
        setActiveScenarioId('live');
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        setGpsError('Chưa có quyền truy cập vị trí. Hãy cho phép định vị trên trình duyệt hoặc chọn thành phố.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  const activeWeather: WeatherSnapshot = useMemo(() => {
    if (activeScenarioId !== 'live') {
      const preset = DEMO_WEATHER_PRESETS[activeScenarioId];
      if (preset) {
        return preset;
      }
    }
    if (liveWeather) {
      return liveWeather;
    }
    return {
      ...DEMO_WEATHER_PRESETS.sunny,
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
