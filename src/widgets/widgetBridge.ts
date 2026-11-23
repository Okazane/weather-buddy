import { NativeModules, Platform } from 'react-native';
import type { CharacterDecision, CharacterSceneId, WeatherSnapshot } from '../core';

export const IOS_APP_GROUP_ID = 'group.com.weatherbuddy.shared';
export const ANDROID_SHARED_PREFS_NAME = 'weather_buddy_widget_prefs';
export const WIDGET_STORAGE_KEY = 'weather_buddy_widget_payload_v1';
export const WIDGET_KIND_ID = 'WeatherBuddyWidget';

export interface WidgetHourlyMiniPoint {
  hourLabel: string;
  tempC: number;
  precipProbPct: number;
}

export interface WidgetSyncPayload {
  gender: 'male' | 'female';
  characterNameVi: string;
  sceneId: CharacterSceneId;
  locationName: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  feelsLikeC: number;
  conditionText: string;
  headlineVi: string;
  outfitAdviceVi: string;
  badgeVi: string;
  hasRainAheadProp: boolean;
  rainAheadHours: number | null;
  hasAqiMask: boolean;
  skyTheme: string;
  updatedAtIso: string;
  hourlyMini: Array<{ hourLabel: string; tempC: number; precipProbPct: number }>;
}

export interface WidgetSyncResult {
  synced: boolean;
  platform: string;
  storageKey: string;
}

export interface WidgetSetupSectionVi {
  id: 'ios_lock_screen' | 'ios_home_standby' | 'android_glance' | 'native_build';
  platform: 'iOS 16+' | 'iOS 17+ / Home' | 'Android 12+' | 'Expo Prebuild';
  titleVi: string;
  subtitleVi: string;
  stepsVi: string[];
}

export interface WidgetSetupGuideVi {
  titleVi: string;
  summaryVi: string;
  iosLockScreen: WidgetSetupSectionVi;
  iosHomeAndStandBy: WidgetSetupSectionVi;
  androidGlance: WidgetSetupSectionVi;
  nativeBuild: WidgetSetupSectionVi;
  sections: WidgetSetupSectionVi[];
}

interface NativeWeatherBuddyWidgetBridge {
  syncWidgetPayload?: (
    payloadJson: string,
    containerOrPrefsName: string
  ) => Promise<boolean> | boolean;
  reloadAllTimelines?: () => Promise<void> | void;
}

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let inMemoryWidgetSnapshotJson: string | null = null;

function getWebLocalStorage(): WebStorageLike | null {
  try {
    const scope = globalThis as unknown as { localStorage?: WebStorageLike };
    if (scope.localStorage && typeof scope.localStorage.setItem === 'function') {
      return scope.localStorage;
    }
  } catch {
    // Ignore storage security errors in sandboxed iframes or private mode
  }
  return null;
}

function getNativeWidgetBridge(): NativeWeatherBuddyWidgetBridge | null {
  const modules = NativeModules as Record<string, unknown> | undefined;
  const candidate = modules?.WeatherBuddyWidgetBridge as
    | NativeWeatherBuddyWidgetBridge
    | undefined;
  if (candidate && typeof candidate.syncWidgetPayload === 'function') {
    return candidate;
  }
  return null;
}

function formatHourLabel(timeIso: string, fallbackIndex: number): string {
  if (!timeIso) {
    return `+${fallbackIndex + 1}h`;
  }

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timeIso.trim());
  if (!hasExplicitTimezone) {
    const localMatch = timeIso.match(/T(\d{2}):(\d{2})/);
    if (localMatch) {
      return `${localMatch[1]}:${localMatch[2]}`;
    }
  }

  const parsed = new Date(timeIso);
  if (!Number.isNaN(parsed.getTime())) {
    const hh = String(parsed.getHours()).padStart(2, '0');
    return `${hh}:00`;
  }

  const fallbackMatch = timeIso.match(/(\d{1,2}):(\d{2})/);
  if (fallbackMatch) {
    return `${fallbackMatch[1].padStart(2, '0')}:${fallbackMatch[2]}`;
  }

  return `+${fallbackIndex + 1}h`;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeRoundTemp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}

export function getCharacterNameVi(gender: 'male' | 'female'): string {
  return gender === 'female' ? 'Cô bé Nắng' : 'Cậu bé Mây';
}

export function formatWidgetRainAlertVi(
  payload: Pick<WidgetSyncPayload, 'hasRainAheadProp' | 'rainAheadHours'>
): string | null {
  if (!payload.hasRainAheadProp) {
    return null;
  }
  if (typeof payload.rainAheadHours === 'number' && payload.rainAheadHours > 0) {
    return `☔ Mưa sau ${payload.rainAheadHours}h`;
  }
  return '☔ Sắp mưa';
}

export function buildWidgetPayload(
  weather: WeatherSnapshot,
  decision: CharacterDecision
): WidgetSyncPayload {
  const hourlySource = Array.isArray(weather.hourly) ? weather.hourly.slice(0, 5) : [];
  const hourlyMini: WidgetHourlyMiniPoint[] = hourlySource.map((point, idx) => ({
    hourLabel: formatHourLabel(point.timeIso, idx),
    tempC: safeRoundTemp(point.temperatureC),
    precipProbPct: clampPercentage(point.precipProbPct),
  }));

  return {
    gender: decision.gender,
    characterNameVi: getCharacterNameVi(decision.gender),
    sceneId: decision.sceneId,
    locationName: weather.locationName || 'Vị trí hiện tại',
    latitude: Number.isFinite(weather.latitude)
      ? Number(weather.latitude.toFixed(5))
      : 0,
    longitude: Number.isFinite(weather.longitude)
      ? Number(weather.longitude.toFixed(5))
      : 0,
    temperatureC: safeRoundTemp(weather.temperatureC),
    feelsLikeC: safeRoundTemp(weather.feelsLikeC),
    conditionText: weather.conditionText || decision.badgeVi,
    headlineVi: decision.headlineVi,
    outfitAdviceVi: decision.outfitAdviceVi,
    badgeVi: decision.badgeVi,
    hasRainAheadProp: Boolean(decision.hasRainAheadProp),
    rainAheadHours:
      typeof decision.rainAheadHours === 'number' ? decision.rainAheadHours : null,
    hasAqiMask: Boolean(decision.hasAqiMask),
    skyTheme: decision.skyTheme,
    updatedAtIso: weather.updatedAtIso || new Date().toISOString(),
    hourlyMini,
  };
}

export async function syncWidgetState(
  payload: WidgetSyncPayload
): Promise<WidgetSyncResult> {
  const serialized = JSON.stringify(payload);
  inMemoryWidgetSnapshotJson = serialized;

  const os = Platform?.OS ?? 'web';

  if (os === 'web') {
    const webStorage = getWebLocalStorage();
    if (webStorage) {
      try {
        webStorage.setItem(WIDGET_STORAGE_KEY, serialized);
        return {
          synced: true,
          platform: 'web',
          storageKey: `localStorage:${WIDGET_STORAGE_KEY}`,
        };
      } catch {
        // Fall through to memory cache result
      }
    }
    return {
      synced: true,
      platform: 'web-memory',
      storageKey: `memory:${WIDGET_STORAGE_KEY}`,
    };
  }

  if (os === 'ios') {
    const storageKey = `${IOS_APP_GROUP_ID}/${WIDGET_STORAGE_KEY}`;
    const nativeBridge = getNativeWidgetBridge();
    if (nativeBridge?.syncWidgetPayload) {
      try {
        await Promise.resolve(
          nativeBridge.syncWidgetPayload(serialized, IOS_APP_GROUP_ID)
        );
        if (nativeBridge.reloadAllTimelines) {
          await Promise.resolve(nativeBridge.reloadAllTimelines());
        }
        return {
          synced: true,
          platform: 'ios',
          storageKey,
        };
      } catch {
        return {
          synced: false,
          platform: 'ios',
          storageKey,
        };
      }
    }
    return {
      synced: false,
      platform: 'ios-bridge-stub',
      storageKey,
    };
  }

  if (os === 'android') {
    const storageKey = `${ANDROID_SHARED_PREFS_NAME}/${WIDGET_STORAGE_KEY}`;
    const nativeBridge = getNativeWidgetBridge();
    if (nativeBridge?.syncWidgetPayload) {
      try {
        await Promise.resolve(
          nativeBridge.syncWidgetPayload(serialized, ANDROID_SHARED_PREFS_NAME)
        );
        if (nativeBridge.reloadAllTimelines) {
          await Promise.resolve(nativeBridge.reloadAllTimelines());
        }
        return {
          synced: true,
          platform: 'android',
          storageKey,
        };
      } catch {
        return {
          synced: false,
          platform: 'android',
          storageKey,
        };
      }
    }
    return {
      synced: false,
      platform: 'android-bridge-stub',
      storageKey,
    };
  }

  return {
    synced: false,
    platform: String(os),
    storageKey: WIDGET_STORAGE_KEY,
  };
}

export function getLastSyncedWidgetPayload(): WidgetSyncPayload | null {
  const webStorage = getWebLocalStorage();
  const raw = webStorage?.getItem(WIDGET_STORAGE_KEY) ?? inMemoryWidgetSnapshotJson;
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as WidgetSyncPayload;
  } catch {
    return null;
  }
}

const IOS_LOCK_SCREEN_SECTION: WidgetSetupSectionVi = {
  id: 'ios_lock_screen',
  platform: 'iOS 16+',
  titleVi: 'Màn hình khóa iPhone',
  subtitleVi: 'Hiển thị nhiệt độ, dự báo mưa sớm và trang phục dưới đồng hồ khóa máy.',
  stepsVi: [
    'Mở WeatherBuddy một lần để chọn thành phố và nhân vật.',
    'Nhấn giữ vùng trống trên Màn hình khóa iPhone -> chọn "Tùy chỉnh" -> "Màn hình khóa".',
    'Chạm khung tiện ích dưới đồng hồ -> tìm "WeatherBuddy" -> chọn ô chữ nhật hoặc ô tròn.',
    'Nhấn "Xong" để lưu.',
  ],
};

const IOS_HOME_STANDBY_SECTION: WidgetSetupSectionVi = {
  id: 'ios_home_standby',
  platform: 'iOS 17+ / Home',
  titleVi: 'Màn hình chính & chế độ StandBy iPhone',
  subtitleVi: 'Hiển thị nhân vật theo thời tiết và dự báo mưa theo giờ.',
  stepsVi: [
    'Nhấn giữ khoảng trống trên Màn hình chính -> chạm dấu (+) góc trên trái.',
    'Tìm "WeatherBuddy" -> chọn cỡ Nhỏ hoặc Trung bình -> nhấn "Thêm tiện ích".',
    'Khi cắm sạc xoay ngang iPhone (iOS 17+), tiện ích tự hiển thị trong chế độ StandBy.',
  ],
};

const ANDROID_GLANCE_SECTION: WidgetSetupSectionVi = {
  id: 'android_glance',
  platform: 'Android 12+',
  titleVi: 'Android Jetpack Glance',
  subtitleVi: 'Tự động cập nhật nền mỗi 15 phút qua WorkManager.',
  stepsVi: [
    'Nhấn giữ khoảng trống trên Màn hình chính Android -> chọn "Tiện ích" (Widgets).',
    'Tìm "WeatherBuddy" và kéo tiện ích ra màn hình.',
    'Kéo viền để mở rộng sang cỡ Trung bình nếu muốn xem thêm dự báo theo giờ.',
  ],
};

const NATIVE_BUILD_SECTION: WidgetSetupSectionVi = {
  id: 'native_build',
  platform: 'Expo Prebuild',
  titleVi: 'Biên dịch Native Extension',
  subtitleVi: 'Tạo bản Development Build để kích hoạt Widget hệ thống ngoài Expo Go.',
  stepsVi: [
    'Kiểm tra plugin "./plugins/withWeatherBuddyWidgets" trong app.json.',
    'Chạy `npx expo prebuild` để tạo cấu hình App Group (iOS) và Receiver (Android).',
    'Chạy `npx expo run:ios --device` hoặc `npx expo run:android`.',
  ],
};

export const WIDGET_SETUP_GUIDE_VI: WidgetSetupGuideVi = {
  titleVi: 'Hướng dẫn thêm Widget',
  summaryVi: 'Đồng bộ nhiệt độ, dự báo mưa 6 giờ tới và chỉ số AQI mỗi 15 phút.',
  iosLockScreen: IOS_LOCK_SCREEN_SECTION,
  iosHomeAndStandBy: IOS_HOME_STANDBY_SECTION,
  androidGlance: ANDROID_GLANCE_SECTION,
  nativeBuild: NATIVE_BUILD_SECTION,
  sections: [
    IOS_LOCK_SCREEN_SECTION,
    IOS_HOME_STANDBY_SECTION,
    ANDROID_GLANCE_SECTION,
    NATIVE_BUILD_SECTION,
  ],
};

export function formatWidgetSetupGuideMarkdownVi(): string {
  const lines: string[] = [
    `# ${WIDGET_SETUP_GUIDE_VI.titleVi}`,
    '',
    WIDGET_SETUP_GUIDE_VI.summaryVi,
    '',
  ];
  for (const section of WIDGET_SETUP_GUIDE_VI.sections) {
    lines.push(`## [${section.platform}] ${section.titleVi}`);
    lines.push(section.subtitleVi);
    section.stepsVi.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.trim()}`);
    });
    lines.push('');
  }
  return lines.join('\n');
}
