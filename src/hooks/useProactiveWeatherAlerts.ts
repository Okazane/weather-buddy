import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  computeDewPointC,
  evaluateNomAmStatus,
  type CharacterDecision,
  type WeatherSnapshot,
} from '../core';

const ALERTS_ENABLED_KEY = 'weather_buddy_alerts_enabled_v1';
const ALERT_DEDUP_KEY = 'weather_buddy_alerts_sent_v1';
const DEDUP_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours per city + alert type

export interface ProactiveAlertStatus {
  supported: boolean;
  enabled: boolean;
  permission: 'default' | 'granted' | 'denied';
  activeBannerVi: string | null;
  dismissBanner: () => void;
  toggleAlerts: () => Promise<void>;
}

function readAlertsEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(ALERTS_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAlertsEnabled(val: boolean): void {
  try {
    globalThis.localStorage?.setItem(ALERTS_ENABLED_KEY, val ? '1' : '0');
  } catch {
    // Ignore storage restrictions
  }
}

function wasRecentlySent(dedupId: string): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(ALERT_DEDUP_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, number>;
    const lastMs = map?.[dedupId];
    return typeof lastMs === 'number' && Date.now() - lastMs < DEDUP_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markAlertSent(dedupId: string): void {
  try {
    const raw = globalThis.localStorage?.getItem(ALERT_DEDUP_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    for (const [k, ts] of Object.entries(map)) {
      if (now - ts > DEDUP_COOLDOWN_MS * 2) {
        delete map[k];
      }
    }
    map[dedupId] = now;
    globalThis.localStorage?.setItem(ALERT_DEDUP_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

function evaluateUrgentAlert(
  weather: WeatherSnapshot,
  decision: CharacterDecision
): { kind: string; titleVi: string; bodyVi: string } | null {
  if (weather.provider === 'demo') return null;

  if (weather.precipMmPerHr >= 4.5 || weather.windGustKmh >= 44) {
    return {
      kind: 'heavy_storm',
      titleVi: `Cảnh báo mưa lớn tại ${weather.locationName}`,
      bodyVi: `Lượng mưa ${weather.precipMmPerHr.toFixed(1)} mm/h, gió giật ${Math.round(
        weather.windGustKmh
      )} km/h — hạn chế di chuyển hoặc mặc áo mưa kín.`,
    };
  }

  if (
    decision.hasRainAheadProp &&
    decision.rainAheadHours !== null &&
    decision.rainAheadHours <= 2
  ) {
    return {
      kind: 'rain_ahead_2h',
      titleVi: `Sắp có mưa tại ${weather.locationName}`,
      bodyVi: `Dự báo có mưa trong khoảng ${decision.rainAheadHours} giờ tới — nhớ mang sẵn ô hoặc áo mưa trước khi ra ngoài.`,
    };
  }

  if (typeof weather.aqi === 'number' && weather.aqi >= 145) {
    const pmPart =
      typeof weather.pm25 === 'number' ? ` (PM2.5 ${weather.pm25.toFixed(1)} µg/m³)` : '';
    return {
      kind: 'high_aqi',
      titleVi: `Chất lượng không khí xấu tại ${weather.locationName}`,
      bodyVi: `Chỉ số AQI ${Math.round(weather.aqi)}${pmPart} — nên đeo khẩu trang lọc bụi mịn khi ra đường.`,
    };
  }

  if (weather.isDay && weather.uvIndex >= 8) {
    return {
      kind: 'extreme_uv',
      titleVi: `Tia cực tím rất gắt tại ${weather.locationName}`,
      bodyVi: `Chỉ số UV đạt ${weather.uvIndex.toFixed(1)} — nên che chắn da, đội mũ và đeo kính râm.`,
    };
  }

  const dp =
    typeof weather.dewPointC === 'number'
      ? weather.dewPointC
      : computeDewPointC(weather.temperatureC, weather.humidityPct);
  const nom = evaluateNomAmStatus(weather.temperatureC, weather.humidityPct, dp);
  if (nom.level === 'severe_nom') {
    return {
      kind: 'nom_am',
      titleVi: `Cảnh báo nồm ẩm tại ${weather.locationName}`,
      bodyVi: nom.adviceVi,
    };
  }

  return null;
}

export function useProactiveWeatherAlerts(
  weather: WeatherSnapshot,
  decision: CharacterDecision,
  isLiveMode: boolean
): ProactiveAlertStatus {
  const supported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'Notification' in window;

  const [enabled, setEnabled] = useState<boolean>(() => readAlertsEnabled());
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>(() =>
    supported ? Notification.permission : 'default'
  );
  const [activeBannerVi, setActiveBannerVi] = useState<string | null>(null);
  const dismissedKeyRef = useRef<string>('');

  // Register PWA offline Service Worker on Web
  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore SW registration restrictions in sandboxed webviews
    });
  }, []);

  useEffect(() => {
    if (!isLiveMode) {
      setActiveBannerVi(null);
      return;
    }
    const alert = evaluateUrgentAlert(weather, decision);
    if (!alert) {
      setActiveBannerVi(null);
      return;
    }

    const dedupKey = `${weather.locationName}:${alert.kind}`;
    if (dismissedKeyRef.current !== dedupKey) {
      setActiveBannerVi(`${alert.titleVi}: ${alert.bodyVi}`);
    }

    if (
      supported &&
      enabled &&
      Notification.permission === 'granted' &&
      !wasRecentlySent(dedupKey)
    ) {
      markAlertSent(dedupKey);
      try {
        new Notification(alert.titleVi, {
          body: alert.bodyVi,
          icon: '/pwa-icon.png',
          tag: dedupKey,
        });
      } catch {
        // Ignore restricted notification contexts
      }
    }
  }, [weather, decision, isLiveMode, supported, enabled]);

  const dismissBanner = useCallback(() => {
    const alert = evaluateUrgentAlert(weather, decision);
    if (alert) {
      dismissedKeyRef.current = `${weather.locationName}:${alert.kind}`;
    }
    setActiveBannerVi(null);
  }, [weather, decision]);

  const toggleAlerts = useCallback(async () => {
    if (!supported) return;
    if (enabled) {
      setEnabled(false);
      writeAlertsEnabled(false);
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = 'denied';
      }
    }
    setPermission(perm);
    if (perm === 'granted') {
      setEnabled(true);
      writeAlertsEnabled(true);
      try {
        new Notification('Đã bật cảnh báo WeatherBuddy', {
          body: `Hệ thống sẽ tự động báo trước khi sắp mưa, UV cao hoặc bụi mịn vượt ngưỡng tại ${weather.locationName}.`,
          icon: '/pwa-icon.png',
          tag: 'weatherbuddy-optin',
        });
      } catch {
        // Ignore
      }
    }
  }, [supported, enabled, weather.locationName]);

  return {
    supported,
    enabled,
    permission,
    activeBannerVi,
    dismissBanner,
    toggleAlerts,
  };
}
