/* Lucian UX/UI Prompt #095 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#095 */
/* Lucian UX/UI Prompt #227 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#227 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowsClockwise,
  ChartBar,
  Compass,
  Crosshair,
} from '../components/AppIcons';
import {
  evaluateCharacterDecision,
  PRESET_CITIES,
  type CharacterDecision,
  type Gender,
  type HourlyForecastPoint,
  type PresetCity,
  type ThermalSensitivity,
  type WeatherProviderType,
  type WeatherSnapshot,
} from '../core';
import {
  fetchWeatherWithBackendFallback,
  resolveBackendBaseUrl,
} from '../hooks/useWeatherBuddy';
import {
  LucianLiveSortableTable,
  LucianMorphingForecastChart,
  useResolvedLucianDark,
  type LucianSortableRow,
} from '../lucian/LucianHubComponents';
import { TermTooltip } from '../components/TermTooltip';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from '../components/themeTokens';

function localizeDisplayTermVi(raw: string): string {
  return sanitizeCopy(raw)
    .replace(/&\s*UV cao/gi, '· Tia cực tím cao')
    .replace(/\bUV cao\b/gi, 'Tia cực tím cao')
    .replace(/\bAQI cao\b/gi, 'Ô nhiễm bụi mịn cao');
}

interface WebDashboardScreenProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  gender: Gender;
  sensitivity: ThermalSensitivity;
  selectedCityId: string;
  onSelectPresetCity: (cityId: string) => void;
  onRequestGps: () => void;
  gpsLoading: boolean;
  providerPref: WeatherProviderType;
  tomorrowIoApiKey: string;
  weatherApiKey: string;
  googleApiKey: string;
}

interface ServerHealthSummary {
  uptimeSec: number;
  refreshIntervalMinutes: number;
  totalRequests: number;
  cacheHits: number;
  cacheHitRatePct: number;
}

interface TelemetryEntry {
  id: string;
  timestampIso: string;
  locationName: string;
  latitude: number;
  longitude: number;
  providerUsed: string;
  cacheHit: boolean;
  latencyMs: number;
  temperatureC: number;
  feelsLikeC: number;
  precipProbPct: number;
  uvIndex: number;
  aqi?: number;
}

interface Analytics24hPayload {
  tempMinC: number;
  tempMaxC: number;
  tempAvgC: number;
  maxPrecipProbPct: number;
  totalPrecipMm: number;
  rainHoursCount: number;
  peakRainHourIso: string | null;
  comfortIndexVi: string;
  hourlySeries: HourlyForecastPoint[];
}

interface DashboardOverviewResponse {
  serverHealth?: ServerHealthSummary;
  analytics24h?: Analytics24hPayload;
  recentTelemetry?: TelemetryEntry[];
}

interface SecurityStatusResponse {
  rateLimitActive?: boolean;
  csrfProtected?: boolean;
  keyRedaction?: boolean;
  headersHardened?: boolean;
  loopbackGuardOnLaunch?: boolean;
}

interface CityComparisonRow {
  city: PresetCity;
  snapshot: WeatherSnapshot | null;
  decision: CharacterDecision | null;
}

function formatHourShort(iso: string | null | undefined, index: number): string {
  if (!iso) {
    return `+${index + 1}h`;
  }
  const trimmed = iso.trim();
  const explicitMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})?$/
  );
  if (explicitMatch) {
    return `${explicitMatch[4]}:00 (${explicitMatch[3]}/${explicitMatch[2]})`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${String(parsed.getHours()).padStart(2, '0')}:00 (${dd}/${mm})`;
  }
  return `+${index + 1}h`;
}

function formatTimeClock(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '--:--:--';
  }
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mo = String(parsed.getMonth() + 1).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  const ss = String(parsed.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} · ${dd}/${mo}`;
}

function computeClientAnalytics24h(weather: WeatherSnapshot): Analytics24hPayload {
  const series = (weather.hourly ?? []).slice(0, 24);
  if (series.length === 0) {
    const rounded = Math.round(weather.temperatureC);
    return {
      tempMinC: rounded,
      tempMaxC: rounded,
      tempAvgC: rounded,
      maxPrecipProbPct: Math.round(weather.precipProbPct),
      totalPrecipMm: Number((weather.precipMmPerHr || 0).toFixed(1)),
      rainHoursCount: weather.precipProbPct >= 45 ? 1 : 0,
      peakRainHourIso: null,
      comfortIndexVi:
        weather.feelsLikeC >= 33
          ? 'Oi nóng'
          : weather.feelsLikeC < 18
            ? 'Se lạnh'
            : 'Dễ chịu',
      hourlySeries: [],
    };
  }

  const temps = series.map((h) => h.temperatureC);
  const tempMinC = Math.round(Math.min(...temps));
  const tempMaxC = Math.round(Math.max(...temps));
  const tempAvgC = Number(
    (temps.reduce((acc, t) => acc + t, 0) / temps.length).toFixed(1)
  );

  let maxPrecipProbPct = 0;
  let totalPrecipMm = 0;
  let rainHoursCount = 0;
  let peakRainHourIso: string | null = null;

  for (const pt of series) {
    const prob = Math.round(pt.precipProbPct || 0);
    const mm = Number(pt.precipMm || 0);
    totalPrecipMm += mm;
    if (prob >= 45 || mm >= 0.3) {
      rainHoursCount += 1;
    }
    if (prob > maxPrecipProbPct) {
      maxPrecipProbPct = prob;
      peakRainHourIso = pt.timeIso;
    }
  }

  const comfortIndexVi =
    tempMaxC >= 34
      ? 'Oi nóng'
      : tempMinC < 16
        ? 'Rét'
        : tempMinC < 21
          ? 'Se lạnh'
          : 'Dễ chịu';

  return {
    tempMinC,
    tempMaxC,
    tempAvgC,
    maxPrecipProbPct,
    totalPrecipMm: Number(totalPrecipMm.toFixed(1)),
    rainHoursCount,
    peakRainHourIso,
    comfortIndexVi,
    hourlySeries: series,
  };
}

export const WebDashboardScreen: React.FC<WebDashboardScreenProps> = ({
  palette,
  weather,
  decision,
  gender,
  sensitivity,
  selectedCityId,
  onSelectPresetCity,
  onRequestGps,
  gpsLoading,
  providerPref,
  tomorrowIoApiKey,
  weatherApiKey,
  googleApiKey,
}) => {
  const { width } = useWindowDimensions();
  const isTwoColTables = width >= 960;
  const isNarrowMobile = width < 440;
  const isDark = useResolvedLucianDark(palette);

  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [securityStatus, setSecurityStatus] =
    useState<SecurityStatusResponse | null>(null);
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(0);
  const [telemetryPaused, setTelemetryPaused] = useState<boolean>(false);
  const [cityRows, setCityRows] = useState<CityComparisonRow[]>(() =>
    PRESET_CITIES.map((city) => ({ city, snapshot: null, decision: null }))
  );
  const [loadingCities, setLoadingCities] = useState<boolean>(false);

  const clientAnalytics = useMemo(
    () => computeClientAnalytics24h(weather),
    [weather]
  );

  const analytics = overview?.analytics24h?.hourlySeries?.length
    ? overview.analytics24h
    : clientAnalytics;

  const range3h = useMemo(() => {
    const pts3 = (weather.hourly ?? []).slice(0, 3);
    const temps3 = [
      weather.temperatureC,
      ...pts3.map((h) => h.temperatureC),
    ];
    const min3 = Math.round(Math.min(...temps3));
    const max3 = Math.round(Math.max(...temps3));
    const avg3 = Number(
      (temps3.reduce((acc, t) => acc + t, 0) / temps3.length).toFixed(1)
    );
    return { min3, max3, avg3 };
  }, [weather.temperatureC, weather.hourly]);

  const aqiStatusLabelVi = useMemo(() => {
    if (typeof weather.aqi !== 'number') {
      return 'Độ sạch không khí (Bụi mịn): Trong lành';
    }
    const aqiVal = Math.round(weather.aqi);
    if (aqiVal >= 130) {
      return `Độ sạch không khí (Bụi mịn): Bụi mịn cao (${aqiVal})`;
    }
    if (aqiVal >= 101) {
      return `Độ sạch không khí (Bụi mịn): Kém cho người nhạy cảm (${aqiVal})`;
    }
    if (aqiVal >= 51) {
      return `Độ sạch không khí (Bụi mịn): Trung bình (${aqiVal})`;
    }
    return `Độ sạch không khí (Bụi mịn): Trong lành (${aqiVal})`;
  }, [weather.aqi]);

  const uvStatusLabelVi = useMemo(() => {
    if (!weather.isDay) {
      return 'Bức xạ tia cực tím: Ban đêm (0)';
    }
    if (weather.uvIndex >= 8) {
      return `Bức xạ tia cực tím: Rất gắt (${weather.uvIndex})`;
    }
    if (weather.uvIndex >= 6) {
      return `Bức xạ tia cực tím: Cao (${weather.uvIndex})`;
    }
    if (weather.uvIndex >= 3) {
      return `Bức xạ tia cực tím: Trung bình (${weather.uvIndex})`;
    }
    return `Bức xạ tia cực tím: Thấp (${weather.uvIndex})`;
  }, [weather.isDay, weather.uvIndex]);

  const chartSeries: HourlyForecastPoint[] = useMemo(() => {
    const raw =
      analytics.hourlySeries && analytics.hourlySeries.length > 0
        ? analytics.hourlySeries
        : weather.hourly ?? [];
    return raw.slice(0, 16);
  }, [analytics, weather.hourly]);

  const fetchBackendOverview = useCallback(async () => {
    if (telemetryPaused) {
      return;
    }
    setLoadingOverview(true);
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), 3500)
      : null;

    try {
      const base = resolveBackendBaseUrl();
      const qs = new URLSearchParams({
        lat: String(weather.latitude),
        lon: String(weather.longitude),
        locationName: weather.locationName,
      });
      const [res, secRes] = await Promise.all([
        fetch(`${base}/api/dashboard/overview?${qs.toString()}`, {
          signal: controller ? controller.signal : undefined,
        }),
        fetch(`${base}/api/security/status`, {
          signal: controller ? controller.signal : undefined,
        }).catch(() => null),
      ]);
      if (res.ok) {
        const data = (await res.json()) as DashboardOverviewResponse;
        setOverview(data);
        setBackendOnline(true);
        if (secRes && secRes.ok) {
          const secData = (await secRes.json()) as SecurityStatusResponse;
          setSecurityStatus(secData);
        }
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      setLoadingOverview(false);
    }
  }, [weather.latitude, weather.longitude, weather.locationName, telemetryPaused]);

  const fetchMultiCityComparison = useCallback(async () => {
    setLoadingCities(true);
    try {
      const results = await Promise.all(
        PRESET_CITIES.map(async (city): Promise<CityComparisonRow> => {
          try {
            const snap = await fetchWeatherWithBackendFallback({
              latitude: city.latitude,
              longitude: city.longitude,
              locationName: city.nameVi,
              provider: providerPref,
              tomorrowIoApiKey,
              weatherApiKey,
              googleApiKey,
            });
            const dec = evaluateCharacterDecision(snap, { gender, sensitivity });
            return { city, snapshot: snap, decision: dec };
          } catch {
            return { city, snapshot: null, decision: null };
          }
        })
      );
      setCityRows(results);
    } finally {
      setLoadingCities(false);
    }
  }, [
    providerPref,
    tomorrowIoApiKey,
    weatherApiKey,
    googleApiKey,
    gender,
    sensitivity,
  ]);

  useEffect(() => {
    fetchBackendOverview();
  }, [fetchBackendOverview]);

  useEffect(() => {
    fetchMultiCityComparison();
  }, [fetchMultiCityComparison]);

  const activeHourPoint: HourlyForecastPoint | null =
    chartSeries[selectedHourIdx] ?? chartSeries[0] ?? null;

  const safeColor = isDark ? '#58C49E' : '#168560';
  const safeSoftBg = isDark
    ? 'rgba(88, 196, 158, 0.15)'
    : 'rgba(22, 133, 96, 0.11)';
  const cautionColor = isDark ? '#E8A849' : '#B86818';
  const hazardColor = isDark ? '#E5737D' : '#C4384B';

  const citySortableRows: ReadonlyArray<LucianSortableRow> = useMemo(
    () =>
      cityRows.map(({ city, snapshot, decision: cityDec }, idx) => {
        const tempRounded = snapshot ? Math.round(snapshot.temperatureC) : -99;
        const rainPct = snapshot ? Math.round(snapshot.precipProbPct) : 0;
        const humPct = snapshot ? Math.round(snapshot.humidityPct) : 0;
        const precipMm = snapshot ? snapshot.precipMmPerHr : 0;
        const statusColor = !snapshot
          ? palette.inkSecondary
          : precipMm >= 4.5 || tempRounded >= 37 || (snapshot.aqi ?? 0) >= 150
            ? hazardColor
            : rainPct >= 50 || tempRounded >= 33 || (snapshot.aqi ?? 0) >= 101
              ? cautionColor
              : tempRounded < 18
                ? palette.accent
                : safeColor;

        return {
          id: city.id,
          primaryText: city.nameVi,
          secondaryText: snapshot
            ? `${city.regionVi} · Ẩm ${humPct}% · Mưa ${rainPct}%`
            : `${city.regionVi} · Đang tải...`,
          metricDisplay: snapshot ? `${tempRounded}°C` : '--°C',
          metricNumeric: snapshot ? snapshot.temperatureC : -99,
          sortTimeOrOrder: idx + 1,
          statusText: cityDec
            ? localizeDisplayTermVi(cityDec.headlineVi)
            : 'Đang đồng bộ',
          statusColor,
          isSelected: selectedCityId === city.id,
        };
      }),
    [
      cityRows,
      selectedCityId,
      palette.inkSecondary,
      palette.accent,
      safeColor,
      cautionColor,
      hazardColor,
    ]
  );

  const backendSortableRows: ReadonlyArray<LucianSortableRow> = useMemo(() => {
    const formatProviderUsedVi = (raw: string | undefined): string => {
      switch (raw) {
        case 'open_meteo':
          return 'Open-Meteo (Đa nguồn)';
        case 'weatherapi':
          return 'WeatherAPI.com';
        case 'tomorrow_io':
          return 'Tomorrow.io';
        case 'google':
          return 'Google Weather';
        case 'demo':
          return 'Kịch bản mẫu';
        default:
          return sanitizeCopy(raw) || 'Trực tiếp';
      }
    };

    const logs = overview?.recentTelemetry ?? [];
    if (backendOnline && logs.length > 0) {
      return logs.slice(0, 6).map((entry, idx) => ({
        id: entry.id || `log_${idx}`,
        primaryText: `${entry.locationName} (${Math.round(entry.temperatureC)}°C)`,
        secondaryText: `${formatTimeClock(entry.timestampIso)} · ${formatProviderUsedVi(
          entry.providerUsed
        )}`,
        metricDisplay: entry.cacheHit ? '0 ms' : `${entry.latencyMs} ms`,
        metricNumeric: entry.cacheHit ? 0 : entry.latencyMs,
        sortTimeOrOrder: Date.parse(entry.timestampIso) || idx,
        statusText: entry.cacheHit ? 'Bộ đệm 15p' : 'Mới tải',
        statusColor: entry.cacheHit ? safeColor : palette.accent,
      }));
    }

    const providerLabel = formatProviderUsedVi(weather.provider);

    return [
      {
        id: 'sys_weather_source',
        primaryText: 'Chỉ số khí tượng thời gian thực',
        secondaryText: `${weather.locationName} · ${aqiStatusLabelVi} · ${uvStatusLabelVi}`,
        metricDisplay: providerLabel,
        metricNumeric: 15,
        sortTimeOrOrder: 1,
        statusText: 'Đang đồng bộ',
        statusColor: safeColor,
      },
      {
        id: 'sys_cache_15m',
        primaryText: 'Bộ đệm dự báo 15 phút',
        secondaryText: backendOnline
          ? `${overview?.serverHealth?.totalRequests ?? 0} lượt truy vấn · Hoạt động ${
              overview?.serverHealth?.uptimeSec ?? 0
            }s`
          : 'Lưu đệm nhanh trên trình duyệt',
        metricDisplay: backendOnline
          ? `${overview?.serverHealth?.cacheHitRatePct ?? 0}%`
          : '15 phút',
        metricNumeric: overview?.serverHealth?.cacheHitRatePct ?? 15,
        sortTimeOrOrder: 2,
        statusText: backendOnline ? 'Máy chủ :8787' : 'Trình duyệt',
        statusColor: backendOnline ? safeColor : palette.accent,
      },
      {
        id: 'sys_hourly_series',
        primaryText: 'Chuỗi dự báo & Biên nhiệt 3h',
        secondaryText: `Biên nhiệt 3h: ${range3h.min3}°–${range3h.max3}°C · Cả ngày ${analytics.tempMinC}°–${analytics.tempMaxC}°C · Mưa đỉnh ${analytics.maxPrecipProbPct}%`,
        metricDisplay: `${chartSeries.length} giờ`,
        metricNumeric: chartSeries.length,
        sortTimeOrOrder: 3,
        statusText: analytics.comfortIndexVi,
        statusColor:
          analytics.comfortIndexVi === 'Oi nóng'
            ? cautionColor
            : analytics.comfortIndexVi === 'Dễ chịu'
              ? safeColor
              : palette.accent,
      },
      {
        id: 'sys_rust_suite',
        primaryText: 'Hạ tầng Rust Native',
        secondaryText: 'Máy chủ Axum :8787 · Tauri v2 Widget · Công cụ đóng gói',
        metricDisplay: backendOnline ? ':8787' : 'Tauri v2',
        metricNumeric: 8787,
        sortTimeOrOrder: 4,
        statusText: backendOnline ? 'Đang chạy' : 'Sẵn sàng',
        statusColor: safeColor,
      },
      {
        id: 'sys_privacy_local',
        primaryText: 'Bảo vệ kết nối cục bộ',
        secondaryText: 'Tự động ẩn danh khóa cá nhân & kiểm soát truy vấn',
        metricDisplay: backendOnline ? '200 OK' : 'Cục bộ',
        metricNumeric: 1,
        sortTimeOrOrder: 5,
        statusText: securityStatus?.csrfProtected ? 'Đang bật' : 'Tiêu chuẩn',
        statusColor: safeColor,
      },
    ];
  }, [
    analytics.comfortIndexVi,
    analytics.maxPrecipProbPct,
    analytics.tempMaxC,
    analytics.tempMinC,
    aqiStatusLabelVi,
    backendOnline,
    cautionColor,
    chartSeries.length,
    overview,
    palette.accent,
    range3h.max3,
    range3h.min3,
    safeColor,
    securityStatus,
    uvStatusLabelVi,
    weather.locationName,
    weather.provider,
  ]);

  return (
    <View style={styles.dashboardStack}>
      {/* Section 1: Backend Server & 15-Minute Sync Telemetry Header + 4 KPI Cards */}
      <View
        style={[
          styles.outerBezel,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.innerCore,
            isNarrowMobile && styles.innerCoreCompact,
            { backgroundColor: palette.coreElevatedBg },
          ]}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleCol}>
              <View style={styles.statusPillRow}>
                <View
                  style={[
                    styles.backendStatusPill,
                    {
                      backgroundColor: backendOnline
                        ? safeSoftBg
                        : palette.accentSoftBg,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: backendOnline
                          ? safeColor
                          : palette.accent,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.backendStatusText,
                      {
                        color: backendOnline ? safeColor : palette.accent,
                      },
                    ]}
                  >
                    {backendOnline
                      ? 'Máy chủ :8787 trực tuyến'
                      : 'Trực tiếp trên trình duyệt'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.coordPill,
                    {
                      backgroundColor: palette.pillIdleBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                  ]}
                >
                  <Compass
                    size={12}
                    color={palette.inkSecondary}
                    weight="duotone"
                  />
                  <Text
                    style={[styles.coordPillText, { color: palette.inkSecondary }]}
                  >
                    {weather.latitude.toFixed(4)}, {weather.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.dashboardTitle, { color: palette.inkPrimary }]}>
                Bảng điều khiển Khí tượng · {weather.locationName}
              </Text>
              <Text style={[styles.dashboardSub, { color: palette.inkSecondary }]}>
                {backendOnline
                  ? `Bộ đệm dự báo 15 phút đang chạy · Tỷ lệ dùng đệm ${
                      overview?.serverHealth?.cacheHitRatePct ?? 0
                    }% (${overview?.serverHealth?.totalRequests ?? 0} yêu cầu)`
                  : 'Tổng hợp dự báo 24 giờ trên trình duyệt · Tự động kết nối cổng 8787 khi bật máy chủ'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Làm mới dữ liệu Dashboard"
              onPress={() => {
                setTelemetryPaused(false);
                fetchBackendOverview();
                fetchMultiCityComparison();
              }}
              style={({ pressed }) => [
                styles.refreshDashBtn,
                WEB_NO_OUTLINE,
                {
                  backgroundColor: palette.pillActiveBg,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              {loadingOverview || loadingCities ? (
                <ActivityIndicator size="small" color={palette.pillActiveInk} />
              ) : (
                <ArrowsClockwise
                  size={13}
                  color={palette.pillActiveInk}
                  weight="bold"
                />
              )}
              <Text
                style={[
                  styles.refreshDashBtnText,
                  { color: palette.pillActiveInk },
                ]}
              >
                Làm mới
              </Text>
            </Pressable>
          </View>

          {/* 4 KPI Summary Cards */}
          <View style={styles.kpiRow}>
            <TermTooltip
              palette={palette}
              align="left"
              containerStyle={styles.kpiTooltipWrap}
              termTitleVi="Biên độ nhiệt 3 giờ tới"
              explanationVi={`Khoảng dao động nhiệt độ thấp nhất – cao nhất trong 3 tiếng sắp tới (${range3h.min3}°–${range3h.max3}°C, trung bình ${range3h.avg3}°C). Biên độ cả ngày 24h là ${analytics.tempMinC}°–${analytics.tempMaxC}°C.`}
            >
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: palette.coreSurfaceBg,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                  Biên nhiệt 3 giờ tới
                </Text>
                <Text style={[styles.kpiValue, { color: palette.inkPrimary }]}>
                  {range3h.min3}° - {range3h.max3}°C
                </Text>
                <Text style={[styles.kpiSub, { color: palette.inkMuted }]}>
                  TB 3h: {range3h.avg3}°C · 24h: {analytics.tempMinC}°-{analytics.tempMaxC}°C
                </Text>
              </View>
            </TermTooltip>

            <TermTooltip
              palette={palette}
              align="left"
              containerStyle={styles.kpiTooltipWrap}
              termTitleVi="Xác suất mưa đỉnh theo giờ"
              explanationVi="Phần trăm (%) khả năng xuất hiện mưa cao nhất trên chuỗi dự báo theo giờ sắp tới, kèm mốc giờ dự kiến mưa đạt đỉnh để bạn chủ động mang ô hoặc áo mưa."
            >
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: palette.coreSurfaceBg,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                  Xác suất mưa đỉnh
                </Text>
                <Text style={[styles.kpiValue, { color: palette.inkPrimary }]}>
                  {analytics.maxPrecipProbPct}%
                </Text>
                <Text style={[styles.kpiSub, { color: palette.inkMuted }]}>
                  {analytics.peakRainHourIso
                    ? `Đỉnh lúc ${formatHourShort(analytics.peakRainHourIso, 0)}`
                    : 'Trời tạnh ráo'}
                </Text>
              </View>
            </TermTooltip>

            <TermTooltip
              palette={palette}
              align="right"
              containerStyle={styles.kpiTooltipWrap}
              termTitleVi="Độ sạch không khí (Bụi mịn) & Bức xạ tia cực tím"
              explanationVi={`${aqiStatusLabelVi}. ${uvStatusLabelVi}. Tổng lượng mưa tích lũy dự kiến: ${analytics.totalPrecipMm} mm (${analytics.rainHoursCount} khung giờ có mưa).`}
            >
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: palette.coreSurfaceBg,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                  Độ sạch không khí & Bức xạ cực tím
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.kpiValueSmall, { color: palette.inkPrimary }]}
                >
                  {typeof weather.aqi === 'number'
                    ? `Bụi mịn ${Math.round(weather.aqi)}`
                    : 'Không khí sạch'}{' '}
                  · {weather.isDay ? `Tia cực tím ${weather.uvIndex}` : 'Ban đêm'}
                </Text>
                <Text style={[styles.kpiSub, { color: palette.inkMuted }]}>
                  Tổng mưa: {analytics.totalPrecipMm} mm ({analytics.rainHoursCount}h mưa)
                </Text>
              </View>
            </TermTooltip>

            <TermTooltip
              palette={palette}
              align="right"
              containerStyle={styles.kpiTooltipWrap}
              termTitleVi="Chỉ số khí tượng thời gian thực & Lời khuyên"
              explanationVi={`Tổng hợp từ nhiệt độ cảm nhận thực tế (${Math.round(weather.feelsLikeC)}°C), độ ẩm (${Math.round(weather.humidityPct)}%), sức gió (${Math.round(weather.windSpeedKmh)} km/giờ) và độ sạch không khí để đưa ra lời khuyên trang phục phù hợp nhất.`}
            >
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: palette.coreSurfaceBg,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                  Chỉ số khí tượng thời gian thực
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.kpiValueSmall, { color: palette.accent }]}
                >
                  {localizeDisplayTermVi(decision.headlineVi)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.kpiSub, { color: palette.inkMuted }]}
                >
                  {localizeDisplayTermVi(decision.outfitAdviceVi)}
                </Text>
              </View>
            </TermTooltip>
          </View>
        </View>
      </View>

      {/* Section 2: Lucian #095 Morphing Bar Chart (Temperature / Rain % / Feels-Like) */}
      <View
        style={[
          styles.outerBezel,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.innerCore,
            isNarrowMobile && styles.innerCoreCompact,
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleCluster}>
              <ChartBar size={16} color={palette.accent} weight="duotone" />
              <Text style={[styles.sectionTitle, { color: palette.inkPrimary }]}>
                Phân tích Biến thiên Nhiệt độ, Mưa & Cảm giác theo giờ
              </Text>
            </View>

            {activeHourPoint && (
              <View
                style={[
                  styles.selectedHourBadge,
                  { backgroundColor: palette.accentSoftBg },
                ]}
              >
                <Text
                  style={[styles.selectedHourBadgeText, { color: palette.accent }]}
                >
                  {formatHourShort(activeHourPoint.timeIso, selectedHourIdx)} ·{' '}
                  {Math.round(activeHourPoint.temperatureC)}°C · Mưa{' '}
                  {Math.round(activeHourPoint.precipProbPct)}%
                </Text>
              </View>
            )}
          </View>

          <LucianMorphingForecastChart
            series={chartSeries}
            currentFeelsLikeC={weather.feelsLikeC}
            selectedHourIdx={selectedHourIdx}
            onSelectHour={setSelectedHourIdx}
            isDark={isDark}
          />
        </View>
      </View>

      {/* Section 3: Dual Lucian #227 Sortable Live Tables (6 Vietnam Cities + Backend :8787 Telemetry & Security) */}
      <View
        style={[
          styles.tablesSplitGrid,
          isTwoColTables ? styles.tablesRowDesktop : styles.tablesColMobile,
        ]}
      >
        <View style={styles.tableHalfCol}>
          <LucianLiveSortableTable
            title="So sánh 6 Thành phố Việt Nam"
            col0Label="Thành phố"
            col1Label="Nhiệt độ"
            col2Label="Trạng thái"
            rows={citySortableRows}
            actionButtonIcon={
              <Crosshair size={13} weight="duotone" color="currentColor" />
            }
            actionButtonLabel={
              gpsLoading ? 'Đang định vị...' : 'GPS của tôi'
            }
            onPressActionButton={onRequestGps}
            onSelectRow={onSelectPresetCity}
            isDark={isDark}
          />
        </View>

        <View style={styles.tableHalfCol}>
          <LucianLiveSortableTable
            title={
              backendOnline && (overview?.recentTelemetry?.length ?? 0) > 0
                ? 'Nhật ký Đồng bộ Máy chủ :8787'
                : 'Thông số Đồng bộ & Hạ tầng'
            }
            col0Label={
              backendOnline && (overview?.recentTelemetry?.length ?? 0) > 0
                ? 'Điểm đo & Nguồn'
                : 'Hạng mục'
            }
            col1Label={
              backendOnline && (overview?.recentTelemetry?.length ?? 0) > 0
                ? 'Độ trễ'
                : 'Thông số'
            }
            col2Label="Trạng thái"
            rows={backendSortableRows}
            actionButtonLabel={telemetryPaused ? 'Tiếp tục' : 'Tạm dừng'}
            onPressActionButton={() => setTelemetryPaused((p) => !p)}
            paused={telemetryPaused}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dashboardStack: {
    width: '100%',
    minWidth: 0,
    gap: 18,
    paddingBottom: 36,
    overflow: 'visible',
  },
  outerBezel: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
    minWidth: 0,
    overflow: 'visible',
  },
  innerCore: {
    borderRadius: 23,
    padding: 20,
    gap: 16,
    minWidth: 0,
    overflow: 'visible',
  },
  innerCoreCompact: {
    padding: 14,
    gap: 13,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    overflow: 'visible',
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 210,
    gap: 6,
    overflow: 'visible',
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    overflow: 'visible',
  },
  backendStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  backendStatusText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
  },
  coordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  coordPillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dashboardTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dashboardSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    lineHeight: 19,
  },
  refreshDashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
  },
  refreshDashBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    overflow: 'visible',
  },
  kpiTooltipWrap: {
    flex: 1,
    minWidth: 145,
  },
  kpiCard: {
    flex: 1,
    width: '100%',
    minWidth: 145,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    gap: 4,
  },
  kpiLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiValueSmall: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: '700',
  },
  kpiSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  selectedHourBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  selectedHourBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tablesSplitGrid: {
    width: '100%',
    minWidth: 0,
    gap: 18,
  },
  tablesRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tablesColMobile: {
    flexDirection: 'column',
  },
  tableHalfCol: {
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
});
